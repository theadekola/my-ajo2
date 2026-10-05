SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

UPDATE dbo.Users
SET IsActive = 0,
    Email = CONCAT('retired-demo-', UserId, '@invalid.local'),
    PasswordHash = CONCAT('RETIRED-DEMO-', UserId, '-', CONVERT(NVARCHAR(36), NEWID())),
    UpdatedAt = SYSUTCDATETIME()
WHERE LOWER(Email) IN (
    'adeola@myajo.app',
    'ifeoma@myajo.app',
    'chioma@myajo.app',
    'musa@myajo.app',
    'kemi@myajo.app'
);

DELETE FROM dbo.OtpCodes
WHERE LOWER(Email) IN (
    'adeola@myajo.app',
    'ifeoma@myajo.app',
    'chioma@myajo.app',
    'musa@myajo.app',
    'kemi@myajo.app'
);

COMMIT TRANSACTION;

PRINT 'Demo accounts have been retired and can no longer sign in.';
