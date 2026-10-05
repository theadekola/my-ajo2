USE MyAjoDB;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> 'MyAjoDB'
    THROW 51000, 'Safety check failed: this script must run against MyAjoDB.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DELETE FROM dbo.Notifications;
    DELETE FROM dbo.PushSubscriptions;
    DELETE FROM dbo.Messages;
    DELETE FROM dbo.DirectDebitPayments;
    DELETE FROM dbo.Payouts;
    DELETE FROM dbo.Contributions;
    DELETE FROM dbo.InviteCodes;
    DELETE FROM dbo.GroupMembers;
    DELETE FROM dbo.GroupPaymentInfo;
    DELETE FROM dbo.AjoGroups;
    DELETE FROM dbo.OtpCodes;
    DELETE FROM dbo.Users;

    DBCC CHECKIDENT ('dbo.Notifications', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.PushSubscriptions', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Messages', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.DirectDebitPayments', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Payouts', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Contributions', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.InviteCodes', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.GroupMembers', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.GroupPaymentInfo', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.AjoGroups', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.OtpCodes', RESEED, 0) WITH NO_INFOMSGS;
    DBCC CHECKIDENT ('dbo.Users', RESEED, 0) WITH NO_INFOMSGS;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT
    (SELECT COUNT(*) FROM dbo.Users) AS Users,
    (SELECT COUNT(*) FROM dbo.AjoGroups) AS Groups,
    (SELECT COUNT(*) FROM dbo.Contributions) AS Contributions,
    (SELECT COUNT(*) FROM dbo.Messages) AS Messages,
    (SELECT COUNT(*) FROM dbo.Notifications) AS Notifications;

PRINT 'MyAjoDB application data has been cleared successfully.';
GO
