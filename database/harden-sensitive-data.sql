USE MyAjoDB;
GO

/* Run before the Node migration so authenticated ciphertext fits safely. */
ALTER TABLE dbo.OtpCodes ALTER COLUMN Code NVARCHAR(64) NOT NULL;
ALTER TABLE dbo.Users ALTER COLUMN Phone NVARCHAR(500) NULL;
ALTER TABLE dbo.Users ALTER COLUMN Address NVARCHAR(MAX) NULL;
ALTER TABLE dbo.Users ALTER COLUMN BankName NVARCHAR(500) NULL;
ALTER TABLE dbo.Users ALTER COLUMN BankAccountNumber NVARCHAR(500) NULL;
ALTER TABLE dbo.Users ALTER COLUMN BankAccountName NVARCHAR(500) NULL;
ALTER TABLE dbo.Users ALTER COLUMN BankRoutingCode NVARCHAR(500) NULL;
ALTER TABLE dbo.GroupPaymentInfo ALTER COLUMN BankName NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.GroupPaymentInfo ALTER COLUMN AccountNumber NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.GroupPaymentInfo ALTER COLUMN AccountName NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.GroupPaymentInfo ALTER COLUMN RoutingCode NVARCHAR(500) NULL;
ALTER TABLE dbo.GroupPaymentInfo ALTER COLUMN Instructions NVARCHAR(MAX) NULL;
ALTER TABLE dbo.DirectDebitPayments ALTER COLUMN BankName NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.DirectDebitPayments ALTER COLUMN AccountNumber NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.DirectDebitPayments ALTER COLUMN AccountName NVARCHAR(500) NOT NULL;
ALTER TABLE dbo.Payouts ALTER COLUMN BankName NVARCHAR(500) NULL;
ALTER TABLE dbo.Payouts ALTER COLUMN AccountNumber NVARCHAR(500) NULL;
ALTER TABLE dbo.Payouts ALTER COLUMN AccountName NVARCHAR(500) NULL;
ALTER TABLE dbo.Payouts ALTER COLUMN Note NVARCHAR(MAX) NULL;
ALTER TABLE dbo.Contributions ALTER COLUMN ReferenceNo NVARCHAR(500) NULL;
ALTER TABLE dbo.Contributions ALTER COLUMN Note NVARCHAR(MAX) NULL;
ALTER TABLE dbo.Messages ALTER COLUMN Body NVARCHAR(MAX) NOT NULL;
IF COL_LENGTH('dbo.Users','AccountDeletionReason') IS NOT NULL
  ALTER TABLE dbo.Users ALTER COLUMN AccountDeletionReason NVARCHAR(MAX) NULL;
IF OBJECT_ID('dbo.PaystackPayments') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_PaystackPayments_Reference' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
    DROP INDEX UX_PaystackPayments_Reference ON dbo.PaystackPayments;
  ALTER TABLE dbo.PaystackPayments ALTER COLUMN Reference NVARCHAR(300) NOT NULL;
  ALTER TABLE dbo.PaystackPayments ALTER COLUMN Note NVARCHAR(MAX) NULL;
  IF COL_LENGTH('dbo.PaystackPayments','ReferenceHash') IS NULL
    ALTER TABLE dbo.PaystackPayments ADD ReferenceHash CHAR(64) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PaystackPayments_ReferenceHash' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
    EXEC(N'CREATE INDEX IX_PaystackPayments_ReferenceHash ON dbo.PaystackPayments(ReferenceHash)');
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_PaystackPayments_ContributionId' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
    EXEC(N'CREATE UNIQUE INDEX UX_PaystackPayments_ContributionId ON dbo.PaystackPayments(ContributionId) WHERE ContributionId IS NOT NULL');
END
IF OBJECT_ID('dbo.PaystackWebhookEvents') IS NULL
BEGIN
  CREATE TABLE dbo.PaystackWebhookEvents (
    WebhookEventId BIGINT IDENTITY(1,1) PRIMARY KEY,
    GatewayEventId NVARCHAR(160) NOT NULL,
    EventType NVARCHAR(80) NOT NULL,
    TransactionId NVARCHAR(100) NULL,
    ReferenceHash CHAR(64) NULL,
    PayloadHash CHAR(64) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    AttemptCount INT NOT NULL DEFAULT 1,
    LastError NVARCHAR(1000) NULL,
    ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ProcessedAt DATETIME2 NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_PaystackWebhookEvents_GatewayEventId ON dbo.PaystackWebhookEvents(GatewayEventId);
END
GO
