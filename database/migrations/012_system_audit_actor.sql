IF OBJECT_ID('dbo.AdminAuditLog') IS NOT NULL
  IF COL_LENGTH('dbo.AdminAuditLog','ActorType') IS NULL
    EXEC sys.sp_executesql N'ALTER TABLE dbo.AdminAuditLog ADD ActorType NVARCHAR(20) NOT NULL CONSTRAINT DF_AdminAuditLog_ActorType DEFAULT ''User'';';
GO
IF OBJECT_ID('dbo.AdminAuditLog') IS NOT NULL
BEGIN
  IF EXISTS(
    SELECT 1 FROM sys.columns
    WHERE object_id=OBJECT_ID('dbo.AdminAuditLog') AND name='ActorUserId' AND is_nullable=0
  )
    ALTER TABLE dbo.AdminAuditLog ALTER COLUMN ActorUserId INT NULL;

  IF NOT EXISTS(
    SELECT 1 FROM sys.check_constraints WHERE name='CK_AdminAuditLog_ActorType'
  )
    ALTER TABLE dbo.AdminAuditLog ADD CONSTRAINT CK_AdminAuditLog_ActorType
      CHECK(ActorType IN('User','System'));
END
GO
