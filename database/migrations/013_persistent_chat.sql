IF COL_LENGTH('dbo.Messages', 'SenderNameOverride') IS NULL
  ALTER TABLE dbo.Messages ADD SenderNameOverride NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.Messages', 'AttachmentUrl') IS NULL
  ALTER TABLE dbo.Messages ADD AttachmentUrl NVARCHAR(500) NULL;

IF COL_LENGTH('dbo.Messages', 'AttachmentName') IS NULL
  ALTER TABLE dbo.Messages ADD AttachmentName NVARCHAR(255) NULL;

IF COL_LENGTH('dbo.Messages', 'AttachmentMimeType') IS NULL
  ALTER TABLE dbo.Messages ADD AttachmentMimeType NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.Messages', 'MessageType') IS NULL
  ALTER TABLE dbo.Messages ADD MessageType NVARCHAR(20) NOT NULL
    CONSTRAINT DF_Messages_MessageType DEFAULT('text');

IF COL_LENGTH('dbo.Messages', 'ReplyToMessageId') IS NULL
  ALTER TABLE dbo.Messages ADD ReplyToMessageId BIGINT NULL;

IF COL_LENGTH('dbo.Messages', 'IsPinned') IS NULL
  ALTER TABLE dbo.Messages ADD IsPinned BIT NOT NULL
    CONSTRAINT DF_Messages_IsPinned DEFAULT(0);

IF COL_LENGTH('dbo.Messages', 'DeletedAt') IS NULL
  ALTER TABLE dbo.Messages ADD DeletedAt DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Messages_Conversation' AND object_id=OBJECT_ID('dbo.Messages'))
  CREATE INDEX IX_Messages_Conversation ON dbo.Messages(GroupId, IsPrivate, RecipientId, CreatedAt);
