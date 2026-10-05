// Countries and territories that do not operate a general-purpose postcode system.
// Every other selectable country is treated as postcode-enabled.
const NO_POSTCODE_COUNTRIES = new Set([
  'AE','AG','AO','AW','BF','BI','BJ','BO','BS','BW','BZ','CF','CG','CI','CK','CM','CD','DJ','DM','ER','FJ','GA','GD','GM','GN','GQ','GY','HK','JM','KI','KM','LC','LY','ML','MO','MR','MW','NA','NR','NU','QA','RW','SB','SC','SL','SO','SR','ST','SX','SY','TD','TG','TK','TL','TO','TT','TV','UG','VU','YE','ZW'
]);

export const countryUsesPostcode = countryCode => !NO_POSTCODE_COUNTRIES.has(String(countryCode || '').toUpperCase());

