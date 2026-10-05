SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.OtpCodes', 'FailedAttempts') IS NULL
  ALTER TABLE dbo.OtpCodes ADD FailedAttempts TINYINT NOT NULL CONSTRAINT DF_OtpCodes_FailedAttempts DEFAULT 0;

IF OBJECT_ID('dbo.RegistrationTickets') IS NULL
BEGIN
  CREATE TABLE dbo.RegistrationTickets (
    RegistrationTicketId BIGINT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL,
    TicketHash CHAR(64) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    UsedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RegistrationTickets_CreatedAt DEFAULT SYSUTCDATETIME()
  );
  CREATE UNIQUE INDEX UX_RegistrationTickets_TicketHash ON dbo.RegistrationTickets(TicketHash);
  CREATE INDEX IX_RegistrationTickets_Email ON dbo.RegistrationTickets(Email,ExpiresAt DESC);
END;

-- Plaintext legacy OTPs are no longer accepted. All pre-deployment codes are invalidated.
UPDATE dbo.OtpCodes SET UsedAt=COALESCE(UsedAt,SYSUTCDATETIME()) WHERE UsedAt IS NULL;
DELETE FROM dbo.OtpCodes WHERE ExpiresAt<=SYSUTCDATETIME();
DELETE FROM dbo.RegistrationTickets WHERE ExpiresAt<=SYSUTCDATETIME();

COMMIT TRANSACTION;
