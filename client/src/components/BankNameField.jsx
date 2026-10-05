import { useEffect, useMemo, useState } from 'react';
import { banksForCountry } from '../data/banks.js';

export default function BankNameField({ countryCode, value, onChange, label = 'BANK NAME', required = false, disabled = false }) {
  const banks = useMemo(() => banksForCountry(countryCode), [countryCode]);
  const isListed = banks.includes(value);
  const [manual, setManual] = useState(Boolean(value) && !isListed);

  useEffect(() => {
    if (value && !banks.includes(value)) setManual(true);
    if (banks.includes(value)) setManual(false);
  }, [banks, value]);

  const selectValue = manual ? '__other__' : value;
  const selectBank = event => {
    const next = event.target.value;
    if (next === '__other__') {
      setManual(true);
      onChange('');
      return;
    }
    setManual(false);
    onChange(next);
  };

  return (
    <div className="fg">
      <label className="fl">{label}</label>
      <select className="fs" value={selectValue} onChange={selectBank} required={required && !manual} disabled={disabled}>
        <option value="">Select your bank</option>
        {banks.map(bank => <option key={bank} value={bank}>{bank}</option>)}
        <option value="__other__">Other — enter bank name manually</option>
      </select>
      {manual ? (
        <input
          className="fi"
          required={required}
          disabled={disabled}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="Enter bank name"
          autoComplete="organization"
          style={{ marginTop: 10 }}
        />
      ) : null}
    </div>
  );
}
