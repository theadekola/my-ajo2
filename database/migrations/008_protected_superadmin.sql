IF COL_LENGTH('dbo.Users', 'IsProtectedAccount') IS NULL
BEGIN
  ALTER TABLE dbo.Users
    ADD IsProtectedAccount BIT NOT NULL
      CONSTRAINT DF_Users_IsProtectedAccount DEFAULT 0;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Users_ProtectSystemAccount
ON dbo.Users
AFTER UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (
    SELECT 1
    FROM deleted d
    LEFT JOIN inserted i ON i.UserId=d.UserId
    WHERE d.IsProtectedAccount=1
      AND (
        i.UserId IS NULL
        OR i.IsProtectedAccount=0
        OR i.SystemRole<>'SuperAdmin'
        OR i.IsActive=0
      )
  )
  BEGIN
    THROW 51001,
      'Protected SuperAdmin accounts cannot be deleted, deactivated, unprotected or demoted.',
      1;
  END;
END;
GO
