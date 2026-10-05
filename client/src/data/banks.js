export const BANKS_BY_COUNTRY = {
  AE: [
    'Abu Dhabi Commercial Bank (ADCB)', 'Abu Dhabi Islamic Bank (ADIB)',
    'Ajman Bank', 'Commercial Bank of Dubai', 'Dubai Islamic Bank',
    'Emirates Islamic', 'Emirates NBD', 'First Abu Dhabi Bank (FAB)',
    'HSBC UAE', 'Mashreq Bank', 'National Bank of Fujairah',
    'National Bank of Ras Al Khaimah (RAKBANK)', 'Sharjah Islamic Bank',
    'Standard Chartered UAE', 'United Arab Bank'
  ],
  GH: [
    'Absa Bank Ghana', 'Access Bank Ghana', 'Agricultural Development Bank',
    'Bank of Africa Ghana', 'CalBank', 'Consolidated Bank Ghana', 'Ecobank Ghana',
    'FBNBank Ghana', 'Fidelity Bank Ghana', 'First Atlantic Bank', 'GCB Bank',
    'Guaranty Trust Bank Ghana', 'Republic Bank Ghana', 'Stanbic Bank Ghana',
    'Standard Chartered Ghana', 'United Bank for Africa Ghana', 'Universal Merchant Bank',
    'Zenith Bank Ghana'
  ],
  NG: [
    'Access Bank', 'Citibank Nigeria', 'Ecobank Nigeria', 'Fidelity Bank',
    'First Bank of Nigeria', 'First City Monument Bank (FCMB)', 'Globus Bank',
    'Guaranty Trust Bank (GTBank)', 'Jaiz Bank', 'Keystone Bank', 'Kuda Bank',
    'Lotus Bank', 'Moniepoint Microfinance Bank', 'Optimus Bank', 'OPay',
    'Parallex Bank', 'Polaris Bank', 'PremiumTrust Bank', 'Providus Bank',
    'Stanbic IBTC Bank', 'Standard Chartered Nigeria', 'Sterling Bank',
    'SunTrust Bank', 'TajBank', 'Titan Trust Bank', 'Union Bank of Nigeria',
    'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank'
  ],
  ZA: [
    'Absa Bank South Africa', 'African Bank', 'Bank Zero', 'Bidvest Bank',
    'Capitec Bank', 'Discovery Bank', 'First National Bank (FNB)', 'Investec Bank',
    'Nedbank', 'Postbank South Africa', 'Sasfin Bank', 'Standard Bank South Africa',
    'TymeBank'
  ],
  GB: [
    'Bank of Scotland', 'Barclays', 'Chase UK', 'Clydesdale Bank', 'Co-operative Bank',
    'First Direct', 'Halifax', 'HSBC UK', 'Lloyds Bank', 'Metro Bank', 'Monzo',
    'Nationwide Building Society', 'NatWest', 'Revolut', 'Royal Bank of Scotland',
    'Santander UK', 'Starling Bank', 'Tesco Bank', 'TSB Bank', 'Virgin Money', 'Wise'
  ],
  US: [
    'Ally Bank', 'American Express National Bank', 'Bank of America',
    'BMO Bank', 'Capital One', 'Chase Bank', 'Citibank', 'Citizens Bank',
    'Discover Bank', 'Fifth Third Bank', 'Huntington National Bank', 'KeyBank',
    'M&T Bank', 'PNC Bank', 'Regions Bank', 'SoFi Bank', 'TD Bank',
    'Truist Bank', 'U.S. Bank', 'Wells Fargo'
  ]
};

export function banksForCountry(countryCode) {
  return BANKS_BY_COUNTRY[String(countryCode || '').toUpperCase()] || [];
}
