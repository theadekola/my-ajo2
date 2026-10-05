/* -------------------------------------------------------------------
   MY AJO — Full Microsoft SQL Server Schema
   All 28 pages fully supported
   Run: sqlcmd -S <server> -i schema.sql
------------------------------------------------------------------- */

IF DB_ID('MyAjoDB') IS NULL CREATE DATABASE MyAjoDB;
GO
USE MyAjoDB;
GO

/* Drop in dependency order */
IF OBJECT_ID('dbo.Messages')            IS NOT NULL DROP TABLE dbo.Messages;
IF OBJECT_ID('dbo.Notifications')       IS NOT NULL DROP TABLE dbo.Notifications;
IF OBJECT_ID('dbo.ActivityEvents')       IS NOT NULL DROP TABLE dbo.ActivityEvents;
IF OBJECT_ID('dbo.PushSubscriptions')   IS NOT NULL DROP TABLE dbo.PushSubscriptions;
IF OBJECT_ID('dbo.DirectDebitPayments') IS NOT NULL DROP TABLE dbo.DirectDebitPayments;
IF OBJECT_ID('dbo.Payouts')             IS NOT NULL DROP TABLE dbo.Payouts;
IF OBJECT_ID('dbo.Contributions')       IS NOT NULL DROP TABLE dbo.Contributions;
IF OBJECT_ID('dbo.InviteCodes')         IS NOT NULL DROP TABLE dbo.InviteCodes;
IF OBJECT_ID('dbo.GroupMembers')        IS NOT NULL DROP TABLE dbo.GroupMembers;
IF OBJECT_ID('dbo.GroupPaymentInfo')    IS NOT NULL DROP TABLE dbo.GroupPaymentInfo;
IF OBJECT_ID('dbo.AjoGroups')           IS NOT NULL DROP TABLE dbo.AjoGroups;
IF OBJECT_ID('dbo.OtpCodes')            IS NOT NULL DROP TABLE dbo.OtpCodes;
IF OBJECT_ID('dbo.Users')               IS NOT NULL DROP TABLE dbo.Users;
GO

/* USERS */
CREATE TABLE dbo.Users (
    UserId           INT IDENTITY(1,1) PRIMARY KEY,
    FirstName        NVARCHAR(80)   NOT NULL,
    LastName         NVARCHAR(80)   NOT NULL,
    Title            NVARCHAR(20)   NULL,
    Email            NVARCHAR(255)  NOT NULL UNIQUE,
    Phone            NVARCHAR(500)  NULL,
    DialCode         NVARCHAR(10)   NULL,
    PasswordHash     NVARCHAR(255)  NOT NULL,
    ProfilePicture   NVARCHAR(500)  NULL,
    Sex              NVARCHAR(10)   NULL,
    Address          NVARCHAR(MAX)  NULL,
    Occupation       NVARCHAR(120)  NULL,
    CountryCode      CHAR(2)        NOT NULL DEFAULT 'NG',
    CurrencyCode     CHAR(3)        NOT NULL DEFAULT 'NGN',
    CurrencySymbol   NVARCHAR(8)    NOT NULL DEFAULT N'₦',
    Language         NVARCHAR(40)   NOT NULL DEFAULT 'English',
    AvatarColor      NVARCHAR(20)   NULL DEFAULT '#2D5040',
    Bio              NVARCHAR(500)  NULL,
    DateOfBirth      DATE           NULL,
    BankName         NVARCHAR(500)  NULL,
    BankAccountNumber NVARCHAR(500) NULL,
    BankAccountName  NVARCHAR(500)  NULL,
    BankRoutingCode  NVARCHAR(500)  NULL,
    SystemRole       NVARCHAR(20)   NOT NULL DEFAULT 'Member'
                     CONSTRAINT CK_Users_SystemRole CHECK (SystemRole IN ('Member','Support','Admin','SuperAdmin')),
    IsProtectedAccount BIT          NOT NULL CONSTRAINT DF_Users_IsProtectedAccount DEFAULT 0,
    OrganizerStatus  NVARCHAR(20)   NOT NULL DEFAULT 'NotApplied'
                     CONSTRAINT CK_Users_OrganizerStatus CHECK (OrganizerStatus IN ('NotApplied','Pending','Approved','Rejected','Suspended')),
    CanCreateGroups  BIT            NOT NULL DEFAULT 0,
    MfaEnabled       BIT            NOT NULL DEFAULT 0,
    MfaSecret        NVARCHAR(500)  NULL,
    MfaPendingSecret NVARCHAR(500)  NULL,
    MfaRecoveryCodes NVARCHAR(MAX)  NULL,
    MfaEnrolledAt    DATETIME2      NULL,
    TokenVersion     INT            NOT NULL DEFAULT 1,
    FailedLoginCount INT            NOT NULL DEFAULT 0,
    LockedUntil      DATETIME2      NULL,
    LastLoginAt      DATETIME2      NULL,
    LastLoginIp      NVARCHAR(64)   NULL,
    IsEmailVerified  BIT            NOT NULL DEFAULT 0,
    OnboardingDone   BIT            NOT NULL DEFAULT 0,
    NotifPayment     BIT            NOT NULL DEFAULT 1,
    NotifPayout      BIT            NOT NULL DEFAULT 1,
    NotifMember      BIT            NOT NULL DEFAULT 1,
    NotifChat        BIT            NOT NULL DEFAULT 1,
    IsActive         BIT            NOT NULL DEFAULT 1,
    GoogleId         NVARCHAR(120)  NULL,
    MicrosoftId      NVARCHAR(120)  NULL,
    ProfileEditedAt  DATETIME2      NULL,
    CreatedAt        DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt        DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Users_Email      ON dbo.Users(Email);
CREATE INDEX IX_Users_SystemRole ON dbo.Users(SystemRole);
GO

/* OTP CODES (email verification + password reset) */
CREATE TABLE dbo.OtpCodes (
    OtpId      INT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT            NULL,
    Email      NVARCHAR(255)  NOT NULL,
    Code       NVARCHAR(10)   NOT NULL,
    Purpose    NVARCHAR(30)   NOT NULL CHECK (Purpose IN ('EmailVerify','PasswordReset')),
    ExpiresAt  DATETIME2      NOT NULL,
    UsedAt     DATETIME2      NULL,
    CreatedAt  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Otp_Email ON dbo.OtpCodes(Email, Purpose);
GO

/* AJO GROUPS */
CREATE TABLE dbo.AjoGroups (
    GroupId            INT IDENTITY(1,1) PRIMARY KEY,
    GroupName          NVARCHAR(120)  NOT NULL,
    Description        NVARCHAR(500)  NULL,
    AdminUserId        INT            NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    CountryCode        CHAR(2)        NOT NULL DEFAULT 'NG',
    CurrencyCode       CHAR(3)        NOT NULL DEFAULT 'NGN',
    CurrencySymbol     NVARCHAR(8)    NOT NULL DEFAULT N'₦',
    ContributionAmount DECIMAL(18,2)  NOT NULL,
    Frequency          NVARCHAR(20)   NOT NULL DEFAULT 'Monthly'
                       CHECK (Frequency IN ('Weekly','Bi-weekly','Monthly')),
    MaxMembers         INT            NOT NULL DEFAULT 10,
    CurrentCycle       INT            NOT NULL DEFAULT 1,
    PayoutOrder        NVARCHAR(20)   NOT NULL DEFAULT 'Fixed'
                       CHECK (PayoutOrder IN ('Fixed','Random','Bidding')),
    StartDate          DATE           NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    GracePeriodDays    INT            NOT NULL DEFAULT 3,
    PenaltyPercent     DECIMAL(5,2)   NOT NULL DEFAULT 5.00,
    AllowPartial       BIT            NOT NULL DEFAULT 0,
    AutoApprove        BIT            NOT NULL DEFAULT 0,
    Icon               NVARCHAR(10)   NULL DEFAULT N'home',
    Status             NVARCHAR(20)   NOT NULL DEFAULT 'Active'
                       CHECK (Status IN ('Active','Pending','Completed','Cancelled')),
    CreatedAt          DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Groups_Admin   ON dbo.AjoGroups(AdminUserId);
CREATE INDEX IX_Groups_Country ON dbo.AjoGroups(CountryCode);
GO

/* GROUP PAYMENT INFO (bank details set by admin) */
CREATE TABLE dbo.GroupPaymentInfo (
    PaymentInfoId  INT IDENTITY(1,1) PRIMARY KEY,
    GroupId        INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId) ON DELETE CASCADE,
    BankName       NVARCHAR(120) NOT NULL,
    AccountNumber  NVARCHAR(60)  NOT NULL,
    AccountName    NVARCHAR(160) NOT NULL,
    RoutingCode    NVARCHAR(30)  NULL,
    Instructions   NVARCHAR(MAX) NULL,
    CreatedAt      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX IX_PayInfo_Group ON dbo.GroupPaymentInfo(GroupId);
GO

/* GROUP MEMBERS */
CREATE TABLE dbo.GroupMembers (
    MemberId     INT IDENTITY(1,1) PRIMARY KEY,
    GroupId      INT NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId) ON DELETE CASCADE,
    UserId       INT NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    SlotNumber   INT NOT NULL DEFAULT 0,
    Role         NVARCHAR(20) NOT NULL DEFAULT 'Member' CHECK (Role IN ('Admin','Member')),
    Status       NVARCHAR(20) NOT NULL DEFAULT 'Pending'
                 CHECK (Status IN ('Pending','Approved','Rejected','Removed')),
    PayoutDate   DATE         NULL,
    HasReceived  BIT          NOT NULL DEFAULT 0,
    JoinedAt     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    ApprovedAt   DATETIME2    NULL,
    CONSTRAINT UQ_GroupUser UNIQUE (GroupId, UserId),
    CONSTRAINT UQ_GroupSlot UNIQUE (GroupId, SlotNumber)
);
CREATE INDEX IX_Members_Group  ON dbo.GroupMembers(GroupId, Status);
CREATE INDEX IX_Members_User   ON dbo.GroupMembers(UserId);
GO

/* INVITE CODES */
CREATE TABLE dbo.InviteCodes (
    InviteCodeId INT IDENTITY(1,1) PRIMARY KEY,
    GroupId      INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId) ON DELETE CASCADE,
    CreatedBy    INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    Code         NVARCHAR(30)  NOT NULL UNIQUE,
    UsageCount   INT           NOT NULL DEFAULT 0,
    MaxUses      INT           NULL,
    ExpiresAt    DATETIME2     NULL,
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_InviteCode ON dbo.InviteCodes(Code, IsActive);
GO

/* ROLE-AWARE ACTIVITY FEED */
CREATE TABLE dbo.ActivityEvents (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    EventType NVARCHAR(100) NOT NULL, Category NVARCHAR(50) NOT NULL,
    Title NVARCHAR(200) NOT NULL, Description NVARCHAR(500) NULL,
    UserId INT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    GroupId INT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    RelatedEntityId BIGINT NULL, RelatedEntityType NVARCHAR(100) NULL,
    Amount DECIMAL(18,2) NULL, Currency NVARCHAR(10) NULL,
    Severity NVARCHAR(20) NOT NULL DEFAULT 'info',
    IsPublic BIT NOT NULL DEFAULT 0, IsAdminOnly BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ActivityEvents_CreatedAt ON dbo.ActivityEvents(CreatedAt DESC);
CREATE INDEX IX_ActivityEvents_Group ON dbo.ActivityEvents(GroupId, CreatedAt DESC);
CREATE INDEX IX_ActivityEvents_User ON dbo.ActivityEvents(UserId, CreatedAt DESC);
GO

/* CONTRIBUTIONS */
CREATE TABLE dbo.Contributions (
    ContributionId INT IDENTITY(1,1) PRIMARY KEY,
    GroupId        INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    UserId         INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    CycleNumber    INT           NOT NULL DEFAULT 1,
    Amount         DECIMAL(18,2) NOT NULL,
    Method         NVARCHAR(30)  NOT NULL DEFAULT 'BankTransfer',
    ReferenceNo    NVARCHAR(500) NULL,
    ReceiptUrl     NVARCHAR(500) NULL,
    Note           NVARCHAR(MAX) NULL,
    Status         NVARCHAR(20)  NOT NULL DEFAULT 'Pending'
                   CHECK (Status IN ('Pending','Confirmed','Rejected','Overdue')),
    ReviewedBy     INT           NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    ReviewedAt     DATETIME2     NULL,
    PaidAt         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedAt      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Contrib_Group  ON dbo.Contributions(GroupId, CycleNumber);
CREATE INDEX IX_Contrib_User   ON dbo.Contributions(UserId);
CREATE INDEX IX_Contrib_Status ON dbo.Contributions(Status);
GO

/* PAYOUTS / DISBURSEMENTS */
CREATE TABLE dbo.Payouts (
    PayoutId      INT IDENTITY(1,1) PRIMARY KEY,
    GroupId       INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    RecipientId   INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    RecordedBy    INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    CycleNumber   INT           NOT NULL,
    Amount        DECIMAL(18,2) NOT NULL,
    AdminCharge   DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalPayout   DECIMAL(18,2) NULL,
    BankName      NVARCHAR(500) NULL,
    AccountNumber NVARCHAR(500) NULL,
    AccountName   NVARCHAR(500) NULL,
    ScheduledFor  DATE          NOT NULL,
    PaidAt        DATETIME2     NULL,
    Note          NVARCHAR(MAX)  NULL,
    EvidenceUrl   NVARCHAR(500) NULL,
    Status        NVARCHAR(20)  NOT NULL DEFAULT 'Scheduled'
                  CHECK (Status IN ('Scheduled','Paid','Cancelled')),
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Payouts_Group ON dbo.Payouts(GroupId, CycleNumber);
GO

/* DIRECT DEBIT PAYMENTS */
CREATE TABLE dbo.DirectDebitPayments (
    DirectDebitId  INT IDENTITY(1,1) PRIMARY KEY,
    GroupId        INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    UserId         INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    BankName       NVARCHAR(500) NOT NULL,
    AccountNumber  NVARCHAR(500) NOT NULL,
    AccountName    NVARCHAR(500) NOT NULL,
    Status         NVARCHAR(20)  NOT NULL DEFAULT 'Active'
                   CHECK (Status IN ('Active','Cancelled')),
    CreatedAt      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* MESSAGES (group chat + private) */
CREATE TABLE dbo.Messages (
    MessageId    INT IDENTITY(1,1) PRIMARY KEY,
    GroupId      INT           NOT NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId) ON DELETE CASCADE,
    SenderId     INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    RecipientId  INT           NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    Body         NVARCHAR(MAX)  NOT NULL,
    IsPrivate    BIT           NOT NULL DEFAULT 0,
    IsRead       BIT           NOT NULL DEFAULT 0,
    SenderNameOverride NVARCHAR(100) NULL,
    AttachmentUrl NVARCHAR(500) NULL,
    AttachmentName NVARCHAR(255) NULL,
    AttachmentMimeType NVARCHAR(100) NULL,
    MessageType NVARCHAR(20) NOT NULL DEFAULT 'text',
    ReplyToMessageId BIGINT NULL,
    IsPinned BIT NOT NULL DEFAULT 0,
    DeletedAt DATETIME2 NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Messages_Group  ON dbo.Messages(GroupId, CreatedAt);
CREATE INDEX IX_Messages_Sender ON dbo.Messages(SenderId);
GO

/* PUSH SUBSCRIPTIONS (mobile/browser push notifications) */
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
GO

/* NOTIFICATIONS */
CREATE TABLE dbo.Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    UserId    INT           NOT NULL FOREIGN KEY REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
    FromUserId INT          NULL FOREIGN KEY REFERENCES dbo.Users(UserId),
    GroupId   INT           NULL FOREIGN KEY REFERENCES dbo.AjoGroups(GroupId),
    Type      NVARCHAR(40)  NOT NULL,
    Title     NVARCHAR(160) NOT NULL,
    Body      NVARCHAR(500) NULL,
    Link      NVARCHAR(200) NULL,
    IsRead    BIT           NOT NULL DEFAULT 0,
    CreatedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Notif_User ON dbo.Notifications(UserId, IsRead, CreatedAt DESC);
GO

/* VIEW: Group summary */
CREATE OR ALTER VIEW dbo.vw_GroupSummary AS
SELECT
    g.GroupId, g.GroupName, g.Icon, g.Frequency, g.Status, g.CountryCode,
    g.CurrencyCode, g.CurrencySymbol, g.ContributionAmount,
    g.CurrentCycle, g.MaxMembers, g.StartDate, g.AdminUserId,
    COUNT(DISTINCT CASE WHEN m.Status='Approved' THEN m.UserId END) AS MemberCount,
    COUNT(DISTINCT CASE WHEN c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle THEN c.UserId END) AS PaidCount,
    ISNULL(SUM(CASE WHEN c.Status='Confirmed' AND c.CycleNumber=g.CurrentCycle THEN c.Amount END),0) AS CollectedThisCycle,
    ISNULL(SUM(CASE WHEN c.Status='Confirmed' THEN c.Amount END),0) AS TotalCollected
FROM dbo.AjoGroups g
LEFT JOIN dbo.GroupMembers  m ON m.GroupId=g.GroupId
LEFT JOIN dbo.Contributions c ON c.GroupId=g.GroupId
GROUP BY g.GroupId, g.GroupName, g.Icon, g.Frequency, g.Status,
         g.CountryCode, g.CurrencyCode, g.CurrencySymbol, g.ContributionAmount,
         g.CurrentCycle, g.MaxMembers, g.StartDate, g.AdminUserId;
GO

/* STORED PROC: join group with country check */
CREATE OR ALTER PROCEDURE dbo.sp_JoinGroup @InviteCode NVARCHAR(30), @UserId INT AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    DECLARE @GroupId INT, @MaxMembers INT, @GroupCountry CHAR(2),
            @GroupName NVARCHAR(120), @AutoApprove BIT;
    SELECT @GroupId=g.GroupId, @MaxMembers=g.MaxMembers,
           @GroupCountry=g.CountryCode, @GroupName=g.GroupName, @AutoApprove=g.AutoApprove
    FROM dbo.InviteCodes ic WITH (UPDLOCK,HOLDLOCK)
    JOIN dbo.AjoGroups g WITH (UPDLOCK,HOLDLOCK) ON g.GroupId=ic.GroupId
    WHERE ic.Code=@InviteCode AND ic.IsActive=1
      AND (ic.ExpiresAt IS NULL OR ic.ExpiresAt > SYSUTCDATETIME())
      AND (ic.MaxUses IS NULL OR ic.UsageCount < ic.MaxUses);
    IF @GroupId IS NULL THROW 50010,'Invalid or expired invite code.',1;

    DECLARE @UserCountry CHAR(2);
    SELECT @UserCountry=CountryCode FROM dbo.Users WHERE UserId=@UserId;
    IF @UserCountry<>@GroupCountry
    BEGIN
        DECLARE @Msg NVARCHAR(400)=N'Country mismatch: this group is for '+@GroupCountry+' members. Your account is registered in '+@UserCountry+'.';
        THROW 50012,@Msg,1;
    END

    IF EXISTS(SELECT 1 FROM dbo.GroupMembers WHERE GroupId=@GroupId AND UserId=@UserId)
        THROW 50014,'You are already a member of this group.',1;

    DECLARE @MemberCount INT=(SELECT COUNT(*) FROM dbo.GroupMembers WITH (UPDLOCK,HOLDLOCK) WHERE GroupId=@GroupId AND Status IN ('Pending','Approved'));
    IF @MemberCount>=@MaxMembers THROW 50016,'This group has reached its maximum number of members.',1;

    DECLARE @Slot INT=(SELECT ISNULL(MAX(SlotNumber),0)+1 FROM dbo.GroupMembers WITH (UPDLOCK,HOLDLOCK) WHERE GroupId=@GroupId);
    DECLARE @Status NVARCHAR(20)=CASE WHEN @AutoApprove=1 THEN 'Approved' ELSE 'Pending' END;

    INSERT dbo.GroupMembers(GroupId,UserId,SlotNumber,Status)
    VALUES(@GroupId,@UserId,@Slot,@Status);

    UPDATE dbo.InviteCodes
      SET UsageCount=UsageCount+1,
          IsActive=CASE WHEN MaxUses IS NOT NULL AND UsageCount+1>=MaxUses THEN 0 ELSE IsActive END
      WHERE Code=@InviteCode AND IsActive=1 AND (MaxUses IS NULL OR UsageCount<MaxUses);
    IF @@ROWCOUNT<>1 THROW 50010,'Invalid or expired invite code.',1;
    COMMIT TRANSACTION;
    SELECT @GroupId AS GroupId, @Slot AS SlotNumber, @GroupName AS GroupName, @Status AS MemberStatus;
END
GO

/* SEED DATA */
IF 1 = 0
BEGIN
DECLARE @hash NVARCHAR(255)='DISABLED-DEMO-SEED';
INSERT dbo.Users(FirstName,LastName,Email,Phone,DialCode,PasswordHash,CountryCode,CurrencyCode,CurrencySymbol,SystemRole,IsEmailVerified,OnboardingDone,AvatarColor)
VALUES
 (N'Adeola',N'Okafor','adeola@myajo.app','8023456789','+234',@hash,'NG','NGN',N'₦','Admin',1,1,'#C8973A'),
 (N'Ifeoma',N'Bello','ifeoma@myajo.app','8034567890','+234',@hash,'NG','NGN',N'₦','Member',1,1,'#2D5040'),
 (N'Chioma',N'Hassan','chioma@myajo.app','8045678901','+234',@hash,'NG','NGN',N'₦','Member',1,1,'#1565C0'),
 (N'Musa',N'Karimi','musa@myajo.app','8056789012','+234',@hash,'NG','NGN',N'₦','Member',1,1,'#6A1B9A'),
 (N'Kemi',N'Eze','kemi@myajo.app','8067890123','+234',@hash,'NG','NGN',N'₦','Admin',1,1,'#2E7D32');

INSERT dbo.AjoGroups(GroupName,AdminUserId,CountryCode,CurrencyCode,CurrencySymbol,ContributionAmount,Frequency,MaxMembers,Icon,Status)
VALUES
 (N'Family Circle',1,'NG','NGN',N'₦',10000,'Monthly',10,N'home','Active'),
 (N'Market Women',1,'NG','NGN',N'₦',5000,'Weekly',15,N'briefcase','Active'),
 (N'School Parents',1,'NG','NGN',N'₦',25000,'Monthly',6,N'book','Pending');

INSERT dbo.GroupPaymentInfo(GroupId,BankName,AccountNumber,AccountName)
VALUES(1,'GTBank','0123456789','Family Circle Ajo'),(2,'Access Bank','9876543210','Market Women Ajo');

INSERT dbo.GroupMembers(GroupId,UserId,SlotNumber,Role,Status,ApprovedAt)
VALUES(1,1,1,'Admin','Approved',SYSUTCDATETIME()),(1,2,2,'Member','Approved',SYSUTCDATETIME()),
      (1,3,3,'Member','Approved',SYSUTCDATETIME()),(1,4,4,'Member','Pending',NULL),
      (2,1,1,'Admin','Approved',SYSUTCDATETIME()),(2,4,2,'Member','Approved',SYSUTCDATETIME()),
      (3,1,1,'Admin','Approved',SYSUTCDATETIME());

INSERT dbo.InviteCodes(GroupId,CreatedBy,Code,IsActive)
VALUES(1,1,'FAMILY-AO7G3K',1),(2,1,'MARKET-XK2P9M',1),(3,1,'SCHOOL-QW8R4T',1);

INSERT dbo.Contributions(GroupId,UserId,CycleNumber,Amount,Method,Status)
VALUES(1,1,1,10000,'BankTransfer','Confirmed'),(1,2,1,10000,'BankTransfer','Confirmed'),
      (1,3,1,10000,'Cash','Confirmed'),(2,1,1,5000,'MobileMoney','Confirmed'),
      (2,4,1,5000,'BankTransfer','Pending');

INSERT dbo.Payouts(GroupId,RecipientId,RecordedBy,CycleNumber,Amount,ScheduledFor,Status)
VALUES(1,3,1,1,80000,DATEADD(DAY,4,CAST(SYSUTCDATETIME() AS DATE)),'Scheduled'),
      (2,4,1,1,60000,CAST(SYSUTCDATETIME() AS DATE),'Paid');

INSERT dbo.Notifications(UserId,GroupId,Type,Title,Body,IsRead)
VALUES(1,1,'MemberJoined','New member request','Musa Karimi wants to join Family Circle',0),
      (2,1,'PaymentConfirmed','Payment confirmed','Your April contribution has been confirmed',0),
      (3,1,'PayoutScheduled','Payout scheduled','You will receive ₦80,000 in 4 days',0);
END
GO
PRINT 'MyAjoDB schema v2 created successfully.';
/* Protected platform-owner accounts cannot be removed or stripped of access. */
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
          AND (i.UserId IS NULL OR i.IsProtectedAccount=0 OR i.SystemRole<>'SuperAdmin' OR i.IsActive=0)
    )
        THROW 51001, 'Protected SuperAdmin accounts cannot be deleted, deactivated, unprotected or demoted.', 1;
END;
GO
