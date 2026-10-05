SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.Users','MfaSecret') IS NULL
  ALTER TABLE dbo.Users ADD MfaSecret NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users','MfaPendingSecret') IS NULL
  ALTER TABLE dbo.Users ADD MfaPendingSecret NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users','MfaRecoveryCodes') IS NULL
  ALTER TABLE dbo.Users ADD MfaRecoveryCodes NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Users','MfaEnrolledAt') IS NULL
  ALTER TABLE dbo.Users ADD MfaEnrolledAt DATETIME2 NULL;

IF EXISTS (
  SELECT GroupId,SlotNumber FROM dbo.GroupMembers
  GROUP BY GroupId,SlotNumber HAVING COUNT(*)>1
)
  THROW 50020,'Duplicate group slot numbers must be resolved before migration 007.',1;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id=OBJECT_ID('dbo.GroupMembers') AND name='UQ_GroupSlot'
)
  CREATE UNIQUE INDEX UQ_GroupSlot ON dbo.GroupMembers(GroupId,SlotNumber);

COMMIT TRANSACTION;
GO

CREATE OR ALTER PROCEDURE dbo.sp_JoinGroup @InviteCode NVARCHAR(30), @UserId INT AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  BEGIN TRANSACTION;

  DECLARE @GroupId INT,@MaxMembers INT,@GroupCountry CHAR(2),
          @GroupName NVARCHAR(120),@AutoApprove BIT;
  SELECT @GroupId=g.GroupId,@MaxMembers=g.MaxMembers,@GroupCountry=g.CountryCode,
         @GroupName=g.GroupName,@AutoApprove=g.AutoApprove
  FROM dbo.InviteCodes ic WITH (UPDLOCK,HOLDLOCK)
  JOIN dbo.AjoGroups g WITH (UPDLOCK,HOLDLOCK) ON g.GroupId=ic.GroupId
  WHERE ic.Code=@InviteCode AND ic.IsActive=1
    AND (ic.ExpiresAt IS NULL OR ic.ExpiresAt>SYSUTCDATETIME())
    AND (ic.MaxUses IS NULL OR ic.UsageCount<ic.MaxUses);
  IF @GroupId IS NULL THROW 50010,'Invalid or expired invite code.',1;

  DECLARE @UserCountry CHAR(2);
  SELECT @UserCountry=CountryCode FROM dbo.Users WHERE UserId=@UserId AND IsActive=1;
  IF @UserCountry IS NULL THROW 50011,'Active user account not found.',1;
  IF @UserCountry<>@GroupCountry
  BEGIN
    DECLARE @Message NVARCHAR(400)=N'Country mismatch: this group is for '+@GroupCountry+' members. Your account is registered in '+@UserCountry+'.';
    THROW 50012,@Message,1;
  END;

  IF EXISTS(SELECT 1 FROM dbo.GroupMembers WITH (UPDLOCK,HOLDLOCK) WHERE GroupId=@GroupId AND UserId=@UserId)
    THROW 50014,'You are already a member of this group.',1;

  DECLARE @MemberCount INT=(SELECT COUNT(*) FROM dbo.GroupMembers WITH (UPDLOCK,HOLDLOCK)
                            WHERE GroupId=@GroupId AND Status IN ('Pending','Approved'));
  IF @MemberCount>=@MaxMembers THROW 50016,'This group has reached its maximum number of members.',1;

  DECLARE @Slot INT=(SELECT ISNULL(MAX(SlotNumber),0)+1 FROM dbo.GroupMembers WITH (UPDLOCK,HOLDLOCK) WHERE GroupId=@GroupId);
  DECLARE @Status NVARCHAR(20)=CASE WHEN @AutoApprove=1 THEN 'Approved' ELSE 'Pending' END;
  INSERT dbo.GroupMembers(GroupId,UserId,SlotNumber,Status) VALUES(@GroupId,@UserId,@Slot,@Status);

  UPDATE dbo.InviteCodes
    SET UsageCount=UsageCount+1,
        IsActive=CASE WHEN MaxUses IS NOT NULL AND UsageCount+1>=MaxUses THEN 0 ELSE IsActive END
    WHERE Code=@InviteCode AND IsActive=1 AND (MaxUses IS NULL OR UsageCount<MaxUses);
  IF @@ROWCOUNT<>1 THROW 50010,'Invalid or expired invite code.',1;

  COMMIT TRANSACTION;
  SELECT @GroupId AS GroupId,@Slot AS SlotNumber,@GroupName AS GroupName,@Status AS MemberStatus;
END;
GO
