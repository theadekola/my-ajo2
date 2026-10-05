SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.Users', 'OrganizerStatus') IS NULL
  ALTER TABLE dbo.Users ADD OrganizerStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_OrganizerStatus DEFAULT 'NotApplied';
IF COL_LENGTH('dbo.Users', 'CanCreateGroups') IS NULL
  ALTER TABLE dbo.Users ADD CanCreateGroups BIT NOT NULL CONSTRAINT DF_Users_CanCreateGroups DEFAULT 0;
IF COL_LENGTH('dbo.Users', 'MfaEnabled') IS NULL
  ALTER TABLE dbo.Users ADD MfaEnabled BIT NOT NULL CONSTRAINT DF_Users_MfaEnabled DEFAULT 0;
IF COL_LENGTH('dbo.Users', 'TokenVersion') IS NULL
  ALTER TABLE dbo.Users ADD TokenVersion INT NOT NULL CONSTRAINT DF_Users_TokenVersion DEFAULT 1;
IF COL_LENGTH('dbo.Users', 'FailedLoginCount') IS NULL
  ALTER TABLE dbo.Users ADD FailedLoginCount INT NOT NULL CONSTRAINT DF_Users_FailedLoginCount DEFAULT 0;
IF COL_LENGTH('dbo.Users', 'LockedUntil') IS NULL ALTER TABLE dbo.Users ADD LockedUntil DATETIME2 NULL;
IF COL_LENGTH('dbo.Users', 'LastLoginAt') IS NULL ALTER TABLE dbo.Users ADD LastLoginAt DATETIME2 NULL;
IF COL_LENGTH('dbo.Users', 'LastLoginIp') IS NULL ALTER TABLE dbo.Users ADD LastLoginIp NVARCHAR(64) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Users_OrganizerStatus')
  EXEC(N'ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_OrganizerStatus CHECK (OrganizerStatus IN (''NotApplied'',''Pending'',''Approved'',''Rejected'',''Suspended''))');

DECLARE @roleConstraint SYSNAME;
SELECT TOP 1 @roleConstraint=cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id=OBJECT_ID('dbo.Users') AND cc.definition LIKE '%SystemRole%';
IF @roleConstraint IS NOT NULL AND @roleConstraint<>'CK_Users_SystemRole'
  EXEC('ALTER TABLE dbo.Users DROP CONSTRAINT '+QUOTENAME(@roleConstraint));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_Users_SystemRole')
  EXEC(N'ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_SystemRole CHECK (SystemRole IN (''Member'',''Support'',''Admin'',''SuperAdmin''))');

-- Existing group administrators become approved organisers without changing their platform role.
UPDATE u SET OrganizerStatus='Approved',CanCreateGroups=1
FROM dbo.Users u
WHERE EXISTS (SELECT 1 FROM dbo.GroupMembers gm WHERE gm.UserId=u.UserId AND gm.Role='Admin');

COMMIT TRANSACTION;
