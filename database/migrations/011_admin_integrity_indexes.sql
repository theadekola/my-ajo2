IF (SELECT COUNT(*) FROM dbo.Users WHERE IsProtectedAccount=1)>1 THROW 51020,'More than one protected account exists. Review protected accounts before migration.',1;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Users') AND name='UX_Users_OneProtectedSuperAdmin')
  CREATE UNIQUE INDEX UX_Users_OneProtectedSuperAdmin ON dbo.Users(IsProtectedAccount) WHERE IsProtectedAccount=1;
GO
IF OBJECT_ID('dbo.AdminPermissions') IS NOT NULL
BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_AdminPermissions_AdminUser') ALTER TABLE dbo.AdminPermissions WITH CHECK ADD CONSTRAINT FK_AdminPermissions_AdminUser FOREIGN KEY(AdminUserId) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_AdminPermissions_GrantedBy') ALTER TABLE dbo.AdminPermissions WITH CHECK ADD CONSTRAINT FK_AdminPermissions_GrantedBy FOREIGN KEY(GrantedBy) REFERENCES dbo.Users(UserId);
END
GO
IF OBJECT_ID('dbo.AdminAuditLog') IS NOT NULL
BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_AdminAuditLog_Actor') ALTER TABLE dbo.AdminAuditLog WITH CHECK ADD CONSTRAINT FK_AdminAuditLog_Actor FOREIGN KEY(ActorUserId) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AdminAuditLog') AND name='IX_AdminAuditLog_CreatedAt') CREATE INDEX IX_AdminAuditLog_CreatedAt ON dbo.AdminAuditLog(CreatedAt DESC);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AdminAuditLog') AND name='IX_AdminAuditLog_Actor') CREATE INDEX IX_AdminAuditLog_Actor ON dbo.AdminAuditLog(ActorUserId,CreatedAt DESC);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AdminAuditLog') AND name='IX_AdminAuditLog_Target') CREATE INDEX IX_AdminAuditLog_Target ON dbo.AdminAuditLog(TargetType,TargetId,CreatedAt DESC);
END
GO
IF OBJECT_ID('dbo.TransactionInvestigations') IS NOT NULL
BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_TransactionInvestigations_Contribution') ALTER TABLE dbo.TransactionInvestigations WITH CHECK ADD CONSTRAINT FK_TransactionInvestigations_Contribution FOREIGN KEY(ContributionId) REFERENCES dbo.Contributions(ContributionId);
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_TransactionInvestigations_AssignedAdmin') ALTER TABLE dbo.TransactionInvestigations WITH CHECK ADD CONSTRAINT FK_TransactionInvestigations_AssignedAdmin FOREIGN KEY(AssignedAdminId) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_TransactionInvestigations_CreatedBy') ALTER TABLE dbo.TransactionInvestigations WITH CHECK ADD CONSTRAINT FK_TransactionInvestigations_CreatedBy FOREIGN KEY(CreatedBy) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TransactionInvestigations') AND name='IX_TransactionInvestigations_Status') CREATE INDEX IX_TransactionInvestigations_Status ON dbo.TransactionInvestigations(Status,CreatedAt DESC);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TransactionInvestigations') AND name='IX_TransactionInvestigations_Contribution') CREATE INDEX IX_TransactionInvestigations_Contribution ON dbo.TransactionInvestigations(ContributionId,CreatedAt DESC);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.TransactionInvestigations') AND name='IX_TransactionInvestigations_Assigned') CREATE INDEX IX_TransactionInvestigations_Assigned ON dbo.TransactionInvestigations(AssignedAdminId,Status);
END
GO
IF OBJECT_ID('dbo.SupportTickets') IS NOT NULL
BEGIN
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_SupportTickets_User') ALTER TABLE dbo.SupportTickets WITH CHECK ADD CONSTRAINT FK_SupportTickets_User FOREIGN KEY(UserId) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_SupportTickets_AssignedAdmin') ALTER TABLE dbo.SupportTickets WITH CHECK ADD CONSTRAINT FK_SupportTickets_AssignedAdmin FOREIGN KEY(AssignedAdminId) REFERENCES dbo.Users(UserId);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SupportTickets') AND name='IX_SupportTickets_StatusPriority') CREATE INDEX IX_SupportTickets_StatusPriority ON dbo.SupportTickets(Status,Priority,UpdatedAt DESC);
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SupportTickets') AND name='IX_SupportTickets_Assigned') CREATE INDEX IX_SupportTickets_Assigned ON dbo.SupportTickets(AssignedAdminId,Status);
END
GO
