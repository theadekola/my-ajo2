USE MyAjoDB;
GO

IF OBJECT_ID('dbo.PushSubscriptions') IS NULL
BEGIN
    CREATE TABLE dbo.PushSubscriptions (
        PushSubscriptionId INT IDENTITY(1,1) PRIMARY KEY,
        UserId    INT            NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        Endpoint  NVARCHAR(1000) NOT NULL,
        P256dh    NVARCHAR(255)  NOT NULL,
        Auth      NVARCHAR(255)  NOT NULL,
        UserAgent NVARCHAR(300)  NULL,
        Enabled   BIT            NOT NULL DEFAULT 1,
        CreatedAt DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_PushSubscriptions_User ON dbo.PushSubscriptions(UserId, Enabled);
END
GO
