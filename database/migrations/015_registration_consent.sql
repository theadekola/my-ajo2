IF COL_LENGTH('dbo.Users', 'TermsAcceptedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD TermsAcceptedAt DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.Users', 'MarketingConsent') IS NULL
BEGIN
  ALTER TABLE dbo.Users ADD MarketingConsent BIT NOT NULL
    CONSTRAINT DF_Users_MarketingConsent DEFAULT(0);
END;
GO
