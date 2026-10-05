/*
  Destructive reset requested for removal of general field encryption.
  MFA secrets and recovery-code hashes are intentionally preserved.

  Back up the database before running this migration. Existing encrypted
  profile, payment, payout, contribution and chat data cannot be recovered
  after this transaction commits.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.Users') IS NOT NULL
BEGIN
  UPDATE dbo.Users
     SET Phone = NULL,
         Address = NULL,
         BankName = NULL,
         BankAccountNumber = NULL,
         BankAccountName = NULL,
         BankRoutingCode = NULL;

  IF COL_LENGTH('dbo.Users', 'AccountDeletionReason') IS NOT NULL
    EXEC(N'UPDATE dbo.Users SET AccountDeletionReason = NULL');
  IF COL_LENGTH('dbo.Users', 'StatusReason') IS NOT NULL
    EXEC(N'UPDATE dbo.Users SET StatusReason = NULL');
END;

IF OBJECT_ID('dbo.AjoGroups') IS NOT NULL
   AND COL_LENGTH('dbo.AjoGroups', 'StatusReason') IS NOT NULL
  EXEC(N'UPDATE dbo.AjoGroups SET StatusReason = NULL');

-- These tables contain required encrypted columns, so their rows must be reset.
IF OBJECT_ID('dbo.GroupPaymentInfo') IS NOT NULL DELETE FROM dbo.GroupPaymentInfo;
IF OBJECT_ID('dbo.DirectDebitPayments') IS NOT NULL DELETE FROM dbo.DirectDebitPayments;
IF OBJECT_ID('dbo.Messages') IS NOT NULL DELETE FROM dbo.Messages;
IF OBJECT_ID('dbo.PaystackPayments') IS NOT NULL DELETE FROM dbo.PaystackPayments;

IF OBJECT_ID('dbo.Contributions') IS NOT NULL
  UPDATE dbo.Contributions SET ReferenceNo = NULL, Note = NULL;

IF OBJECT_ID('dbo.Payouts') IS NOT NULL
  UPDATE dbo.Payouts
     SET BankName = NULL,
         AccountNumber = NULL,
         AccountName = NULL,
         Note = NULL;

COMMIT TRANSACTION;

SELECT
  (SELECT COUNT(*) FROM dbo.Users WHERE MfaSecret IS NOT NULL OR MfaPendingSecret IS NOT NULL) AS PreservedMfaUsers,
  (SELECT COUNT(*) FROM dbo.Users WHERE Phone IS NOT NULL OR Address IS NOT NULL OR BankName IS NOT NULL
      OR BankAccountNumber IS NOT NULL OR BankAccountName IS NOT NULL OR BankRoutingCode IS NOT NULL) AS RemainingUserSensitiveValues;
