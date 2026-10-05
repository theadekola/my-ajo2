IF OBJECT_ID('dbo.ChatUserBlocks', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChatUserBlocks (
    BlockerUserId INT NOT NULL,
    BlockedUserId INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ChatUserBlocks_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ChatUserBlocks PRIMARY KEY (BlockerUserId, BlockedUserId),
    CONSTRAINT CK_ChatUserBlocks_DifferentUsers CHECK (BlockerUserId <> BlockedUserId),
    CONSTRAINT FK_ChatUserBlocks_Blocker FOREIGN KEY (BlockerUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ChatUserBlocks_Blocked FOREIGN KEY (BlockedUserId) REFERENCES dbo.Users(UserId)
  );
END;

IF OBJECT_ID('dbo.ChatReports', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ChatReports (
    ReportId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatReports PRIMARY KEY,
    ReporterUserId INT NOT NULL,
    ReportedUserId INT NOT NULL,
    GroupId INT NOT NULL,
    MessageId INT NULL,
    ReportType NVARCHAR(20) NOT NULL,
    Reason NVARCHAR(100) NOT NULL,
    Details NVARCHAR(1000) NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ChatReports_Status DEFAULT N'Pending',
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ChatReports_CreatedAt DEFAULT SYSUTCDATETIME(),
    ReviewedAt DATETIME2 NULL,
    ReviewedBy INT NULL,
    ResolutionNote NVARCHAR(1000) NULL,
    CONSTRAINT CK_ChatReports_DifferentUsers CHECK (ReporterUserId <> ReportedUserId),
    CONSTRAINT CK_ChatReports_Type CHECK (ReportType IN (N'Message', N'User')),
    CONSTRAINT CK_ChatReports_Status CHECK (Status IN (N'Pending', N'Reviewed', N'Dismissed', N'Actioned')),
    CONSTRAINT FK_ChatReports_Reporter FOREIGN KEY (ReporterUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ChatReports_Reported FOREIGN KEY (ReportedUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_ChatReports_Group FOREIGN KEY (GroupId) REFERENCES dbo.AjoGroups(GroupId),
    CONSTRAINT FK_ChatReports_Message FOREIGN KEY (MessageId) REFERENCES dbo.Messages(MessageId),
    CONSTRAINT FK_ChatReports_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users(UserId)
  );
  CREATE INDEX IX_ChatReports_StatusCreatedAt ON dbo.ChatReports(Status, CreatedAt DESC);
  CREATE INDEX IX_ChatReports_ReportedUser ON dbo.ChatReports(ReportedUserId, CreatedAt DESC);
  CREATE UNIQUE INDEX UX_ChatReports_PendingMessage ON dbo.ChatReports(ReporterUserId, MessageId) WHERE Status=N'Pending' AND MessageId IS NOT NULL;
  CREATE UNIQUE INDEX UX_ChatReports_PendingUser ON dbo.ChatReports(ReporterUserId, ReportedUserId, GroupId) WHERE Status=N'Pending' AND MessageId IS NULL;
END;
