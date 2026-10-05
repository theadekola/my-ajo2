IF COL_LENGTH('dbo.Users','AccountStatus') IS NULL ALTER TABLE dbo.Users ADD AccountStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_AccountStatus DEFAULT 'Active';
IF COL_LENGTH('dbo.Users','StatusReason') IS NULL ALTER TABLE dbo.Users ADD StatusReason NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Users','StatusUntil') IS NULL ALTER TABLE dbo.Users ADD StatusUntil DATETIME2 NULL;
IF COL_LENGTH('dbo.Users','MustResetPassword') IS NULL ALTER TABLE dbo.Users ADD MustResetPassword BIT NOT NULL CONSTRAINT DF_Users_MustResetPassword DEFAULT 0;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_Users_AccountStatus') ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_AccountStatus CHECK(AccountStatus IN('Active','Suspended','Blocked','Deactivated','Deleted'));
GO
IF COL_LENGTH('dbo.AjoGroups','StatusReason') IS NULL ALTER TABLE dbo.AjoGroups ADD StatusReason NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.AjoGroups','StatusUntil') IS NULL ALTER TABLE dbo.AjoGroups ADD StatusUntil DATETIME2 NULL;
GO
DECLARE @constraint SYSNAME,@dropSql NVARCHAR(1000);
SELECT TOP 1 @constraint=cc.name FROM sys.check_constraints cc WHERE cc.parent_object_id=OBJECT_ID('dbo.AjoGroups') AND cc.definition LIKE '%Status%';
IF @constraint IS NOT NULL
BEGIN
 SET @dropSql=N'ALTER TABLE dbo.AjoGroups DROP CONSTRAINT '+QUOTENAME(@constraint)+N';';
 EXEC sys.sp_executesql @dropSql;
END;
ALTER TABLE dbo.AjoGroups ADD CONSTRAINT CK_AjoGroups_Status CHECK(Status IN('Active','Pending','Paused','Completed','Suspended','Archived','Cancelled'));
GO
IF OBJECT_ID('dbo.AdminAuditLog') IS NULL CREATE TABLE dbo.AdminAuditLog(
 AuditId BIGINT IDENTITY PRIMARY KEY,ActorUserId INT NOT NULL,Action NVARCHAR(80) NOT NULL,TargetType NVARCHAR(40) NOT NULL,TargetId NVARCHAR(80) NOT NULL,
 PreviousValue NVARCHAR(MAX) NULL,NewValue NVARCHAR(MAX) NULL,Reason NVARCHAR(500) NOT NULL,InternalNote NVARCHAR(MAX) NULL,IpAddress NVARCHAR(64) NULL,Result NVARCHAR(20) NOT NULL DEFAULT 'Success',CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
CREATE OR ALTER TRIGGER dbo.TR_AdminAuditLog_AppendOnly ON dbo.AdminAuditLog INSTEAD OF UPDATE,DELETE AS THROW 51010,'Administrative audit logs are append-only.',1;
GO
CREATE OR ALTER TRIGGER dbo.TR_Users_ProtectSystemAccount ON dbo.Users AFTER UPDATE,DELETE AS
BEGIN SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.UserId=d.UserId WHERE d.IsProtectedAccount=1 AND(i.UserId IS NULL OR i.IsProtectedAccount=0 OR i.SystemRole<>'SuperAdmin' OR i.IsActive=0 OR i.AccountStatus<>'Active' OR i.LockedUntil IS NOT NULL))
 THROW 51001,'Protected SuperAdmin accounts cannot be deleted, blocked, suspended, deactivated, locked, unprotected or demoted.',1;
END;
GO
