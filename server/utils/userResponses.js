// Explicit allowlists prevent new database columns leaking into session responses.
export const SESSION_FIELDS = ['UserId','FirstName','LastName','ProfilePicture','AvatarColor',
  'CountryCode','CurrencyCode','CurrencySymbol','Language','OrganizerStatus','CanCreateGroups',
  'MfaEnabled','MfaVerifiedAt','IsEmailVerified','OnboardingDone','NotifPayment','NotifPayout','NotifMember','NotifChat',
  'AdminGroupMembersAnonymous'];
export const PROFILE_FIELDS = ['Title','Email','Phone','DialCode','Sex','Address','Occupation',
  'Bio','DateOfBirth','ProfileEditedAt','CreatedAt'];
export const BANK_FIELDS = ['BankName','BankAccountNumber','BankAccountName','BankRoutingCode'];
export function pickFields(user, fields) {
  return Object.fromEntries(fields.filter(key => user?.[key] !== undefined).map(key => [key,user[key]]));
}
export function sessionUser(user) {
  return {...pickFields(user,SESSION_FIELDS), Capabilities:{
    canAccessAdmin:['Admin','SuperAdmin'].includes(user?.SystemRole),
    canDeleteAccount:!!user && !user.IsProtectedAccount && user.SystemRole !== 'SuperAdmin'
  }};
}
