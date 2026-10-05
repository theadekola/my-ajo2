USE MyAjoDB;
GO
IF OBJECT_ID('dbo.ActivityEvents') IS NULL
BEGIN
  CREATE TABLE dbo.ActivityEvents (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    EventType NVARCHAR(100) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    UserId INT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    GroupId INT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    RelatedEntityId BIGINT NULL,
    RelatedEntityType NVARCHAR(100) NULL,
    Amount DECIMAL(18,2) NULL,
    Currency NVARCHAR(10) NULL,
    Severity NVARCHAR(20) NOT NULL DEFAULT 'info',
    IsPublic BIT NOT NULL DEFAULT 0,
    IsAdminOnly BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_ActivityEvents_CreatedAt ON dbo.ActivityEvents(CreatedAt DESC);
  CREATE INDEX IX_ActivityEvents_Group ON dbo.ActivityEvents(GroupId, CreatedAt DESC);
  CREATE INDEX IX_ActivityEvents_User ON dbo.ActivityEvents(UserId, CreatedAt DESC);
END
GO
