import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();
const production = process.env.NODE_ENV === 'production';
const requiredDatabaseSettings = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
if (production) {
  const missing = requiredDatabaseSettings.filter(name => !String(process.env[name] || '').trim());
  if (missing.length) throw new Error(`Missing production database configuration: ${missing.join(', ')}`);
  if (String(process.env.DB_USER).trim().toLowerCase() === 'sa') {
    throw new Error('Production DB_USER must be a restricted application account, not sa');
  }
  if (process.env.DB_ENCRYPT !== 'true' || process.env.DB_TRUST_CERT !== 'false') {
    throw new Error('Production MSSQL connections require DB_ENCRYPT=true and DB_TRUST_CERT=false');
  }
}
const cfg = {
  server: process.env.DB_SERVER || (production ? undefined : 'localhost'),
  database: process.env.DB_NAME || (production ? undefined : 'MyAjoDB'),
  user: process.env.DB_USER || (production ? undefined : 'myajo_dev'),
  password: process.env.DB_PASSWORD || (production ? undefined : 'local-development-only'),
  port: parseInt(process.env.DB_PORT||'1433'),
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT_MS || '15000', 10),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
  options: { encrypt: process.env.DB_ENCRYPT!=='false', trustServerCertificate: process.env.DB_TRUST_CERT==='true' },
  pool: { max:10, min:0, idleTimeoutMillis:30000 }
};
let poolPromise;
export async function getPool(){
  if(!poolPromise){
    const connection=new sql.ConnectionPool(cfg);
    poolPromise=connection.connect().catch(error=>{poolPromise=null;throw error;});
  }
  const pool=await poolPromise;
  if(!pool.connected){poolPromise=null;return getPool();}
  return pool;
}
export async function ensurePrivacyColumns(){
  const pool = await getPool();
  await pool.request().query(`
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
    IF COL_LENGTH('dbo.Payouts', 'EvidenceUrl') IS NULL
    BEGIN
      ALTER TABLE dbo.Payouts ADD EvidenceUrl NVARCHAR(500) NULL;
    END
    IF COL_LENGTH('dbo.Payouts', 'AdminCharge') IS NULL
    BEGIN
      ALTER TABLE dbo.Payouts ADD AdminCharge DECIMAL(18,2) NOT NULL CONSTRAINT DF_Payouts_AdminCharge DEFAULT(0);
    END
    IF COL_LENGTH('dbo.Payouts', 'TotalPayout') IS NULL
    BEGIN
      ALTER TABLE dbo.Payouts ADD TotalPayout DECIMAL(18,2) NULL;
    END
    ALTER TABLE dbo.Contributions ALTER COLUMN ReferenceNo NVARCHAR(500) NULL;
    ALTER TABLE dbo.Contributions ALTER COLUMN Note NVARCHAR(MAX) NULL;

    IF COL_LENGTH('dbo.Users', 'AdminGroupMembersAnonymous') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AdminGroupMembersAnonymous BIT NOT NULL CONSTRAINT DF_Users_AdminGroupMembersAnonymous DEFAULT(0);
    END

    IF COL_LENGTH('dbo.AjoGroups', 'GroupMembersAnonymous') IS NULL
    BEGIN
      ALTER TABLE dbo.AjoGroups ADD GroupMembersAnonymous BIT NOT NULL CONSTRAINT DF_AjoGroups_GroupMembersAnonymous DEFAULT(0);
    END
    IF COL_LENGTH('dbo.AjoGroups', 'PaymentDayOfWeek') IS NULL
      ALTER TABLE dbo.AjoGroups ADD PaymentDayOfWeek TINYINT NULL;
    IF COL_LENGTH('dbo.AjoGroups', 'PaymentDayOfMonth') IS NULL
      ALTER TABLE dbo.AjoGroups ADD PaymentDayOfMonth TINYINT NULL;
    IF COL_LENGTH('dbo.Messages', 'SenderNameOverride') IS NULL
      ALTER TABLE dbo.Messages ADD SenderNameOverride NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.Messages', 'AttachmentUrl') IS NULL
      ALTER TABLE dbo.Messages ADD AttachmentUrl NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.Messages', 'AttachmentName') IS NULL
      ALTER TABLE dbo.Messages ADD AttachmentName NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.Messages', 'AttachmentMimeType') IS NULL
      ALTER TABLE dbo.Messages ADD AttachmentMimeType NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.Messages', 'MessageType') IS NULL
      ALTER TABLE dbo.Messages ADD MessageType NVARCHAR(20) NOT NULL CONSTRAINT DF_Messages_MessageType DEFAULT('text');
    IF COL_LENGTH('dbo.Messages', 'ReplyToMessageId') IS NULL
      ALTER TABLE dbo.Messages ADD ReplyToMessageId BIGINT NULL;
    IF COL_LENGTH('dbo.Messages', 'IsPinned') IS NULL
      ALTER TABLE dbo.Messages ADD IsPinned BIT NOT NULL CONSTRAINT DF_Messages_IsPinned DEFAULT(0);
    IF COL_LENGTH('dbo.Messages', 'DeletedAt') IS NULL
      ALTER TABLE dbo.Messages ADD DeletedAt DATETIME2 NULL;
    IF OBJECT_ID('dbo.AutomationRuns') IS NULL
    BEGIN
      CREATE TABLE dbo.AutomationRuns (
        AutomationKey NVARCHAR(200) NOT NULL PRIMARY KEY,
        CompletedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END

    IF COL_LENGTH('dbo.Users', 'AccountDeletionStatus') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionStatus NVARCHAR(40) NULL;
    END
    IF COL_LENGTH('dbo.Users', 'AccountDeletionRequestedAt') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionRequestedAt DATETIME2 NULL;
    END
    IF COL_LENGTH('dbo.Users', 'AccountDeletionApprovedAt') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionApprovedAt DATETIME2 NULL;
    END
    IF COL_LENGTH('dbo.Users', 'AccountDeletionDueAt') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionDueAt DATETIME2 NULL;
    END
    IF COL_LENGTH('dbo.Users', 'AccountDeletionReason') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionReason NVARCHAR(MAX) NULL;
    END
    ELSE ALTER TABLE dbo.Users ALTER COLUMN AccountDeletionReason NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.Users', 'AccountDeletionRating') IS NULL
    BEGIN
      ALTER TABLE dbo.Users ADD AccountDeletionRating INT NULL;
    END

    IF OBJECT_ID('dbo.AccountDeletionRequests') IS NULL
    BEGIN
      CREATE TABLE dbo.AccountDeletionRequests (
        RequestId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        GroupId INT NOT NULL,
        AdminUserId INT NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        RespondedAt DATETIME2 NULL,
        ResponseNote NVARCHAR(1200) NULL
      );
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_AccountDeletionRequests_Admin' AND object_id=OBJECT_ID('dbo.AccountDeletionRequests'))
    BEGIN
      CREATE INDEX IX_AccountDeletionRequests_Admin ON dbo.AccountDeletionRequests(AdminUserId, Status, RequestedAt DESC);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_AccountDeletionRequests_User' AND object_id=OBJECT_ID('dbo.AccountDeletionRequests'))
    BEGIN
      CREATE INDEX IX_AccountDeletionRequests_User ON dbo.AccountDeletionRequests(UserId, Status, RequestedAt DESC);
    END
  `);
}

export async function ensurePaystackTables(){
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.PaystackPayments') IS NULL
    BEGIN
      CREATE TABLE dbo.PaystackPayments (
        PaymentId INT IDENTITY(1,1) PRIMARY KEY,
        ContributionId INT NULL,
        GroupId INT NOT NULL,
        UserId INT NOT NULL,
        CycleNumber INT NOT NULL DEFAULT 1,
        Reference NVARCHAR(300) NOT NULL,
        ReferenceHash CHAR(64) NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Currency NVARCHAR(10) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'Pending',
        Gateway NVARCHAR(30) NOT NULL DEFAULT 'Paystack',
        Channel NVARCHAR(50) NULL,
        AuthorizationUrl NVARCHAR(1000) NULL,
        AccessCode NVARCHAR(200) NULL,
        PaystackTransactionId NVARCHAR(100) NULL,
        PaymentType NVARCHAR(50) NOT NULL DEFAULT 'Contribution',
        Note NVARCHAR(1200) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PaidAt DATETIME2 NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
    IF COL_LENGTH('dbo.PaystackPayments', 'ReferenceHash') IS NULL
      ALTER TABLE dbo.PaystackPayments ADD ReferenceHash CHAR(64) NULL;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_PaystackPayments_Reference' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
      DROP INDEX UX_PaystackPayments_Reference ON dbo.PaystackPayments;
    ALTER TABLE dbo.PaystackPayments ALTER COLUMN Reference NVARCHAR(300) NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PaystackPayments_ReferenceHash' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
      EXEC(N'CREATE INDEX IX_PaystackPayments_ReferenceHash ON dbo.PaystackPayments(ReferenceHash)');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_PaystackPayments_ContributionId' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
      EXEC(N'CREATE UNIQUE INDEX UX_PaystackPayments_ContributionId ON dbo.PaystackPayments(ContributionId) WHERE ContributionId IS NOT NULL');
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PaystackPayments_User' AND object_id=OBJECT_ID('dbo.PaystackPayments'))
    BEGIN
      CREATE INDEX IX_PaystackPayments_User ON dbo.PaystackPayments(UserId, CreatedAt DESC);
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
  `);
}
export async function ensureActivityTables(){
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.ActivityEvents') IS NULL
    BEGIN
      CREATE TABLE dbo.ActivityEvents (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        EventType NVARCHAR(100) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        UserId INT NULL,
        GroupId INT NULL,
        RelatedEntityId BIGINT NULL,
        RelatedEntityType NVARCHAR(100) NULL,
        Amount DECIMAL(18,2) NULL,
        Currency NVARCHAR(10) NULL,
        Severity NVARCHAR(20) NOT NULL CONSTRAINT DF_ActivityEvents_Severity DEFAULT 'info',
        IsPublic BIT NOT NULL CONSTRAINT DF_ActivityEvents_IsPublic DEFAULT 0,
        IsAdminOnly BIT NOT NULL CONSTRAINT DF_ActivityEvents_IsAdminOnly DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ActivityEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ActivityEvents_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_ActivityEvents_Group FOREIGN KEY (GroupId) REFERENCES dbo.AjoGroups(GroupId)
      );
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ActivityEvents_CreatedAt' AND object_id=OBJECT_ID('dbo.ActivityEvents'))
      CREATE INDEX IX_ActivityEvents_CreatedAt ON dbo.ActivityEvents(CreatedAt DESC);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ActivityEvents_Group' AND object_id=OBJECT_ID('dbo.ActivityEvents'))
      CREATE INDEX IX_ActivityEvents_Group ON dbo.ActivityEvents(GroupId, CreatedAt DESC);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ActivityEvents_User' AND object_id=OBJECT_ID('dbo.ActivityEvents'))
      CREATE INDEX IX_ActivityEvents_User ON dbo.ActivityEvents(UserId, CreatedAt DESC);
  `);
}
export { sql };

