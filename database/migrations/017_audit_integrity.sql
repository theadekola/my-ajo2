-- Deploy with npm run migrate before starting this version.
IF COL_LENGTH('dbo.Users','ProfileEditedAt') IS NULL ALTER TABLE dbo.Users ADD ProfileEditedAt DATETIME2 NULL;
GO
IF COL_LENGTH('dbo.Payouts','RequestKey') IS NULL ALTER TABLE dbo.Payouts ADD RequestKey NVARCHAR(100) NULL, RequestHash CHAR(64) NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Payouts_RequestKey' AND object_id=OBJECT_ID('dbo.Payouts'))
 CREATE UNIQUE INDEX UX_Payouts_RequestKey ON dbo.Payouts(RecordedBy,RequestKey) WHERE RequestKey IS NOT NULL;
GO
IF OBJECT_ID('dbo.PushOutbox','U') IS NULL
 CREATE TABLE dbo.PushOutbox(OutboxId BIGINT IDENTITY PRIMARY KEY,UserId INT NOT NULL,Payload NVARCHAR(MAX) NOT NULL,Attempts INT NOT NULL DEFAULT 0,NextAttemptAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),DeliveredAt DATETIME2 NULL,LastError NVARCHAR(500) NULL,CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
