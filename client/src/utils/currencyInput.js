export const parseCurrencyValue = value => {
  const cleaned = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

export const formatCurrencyInput = value => {
  const cleaned = parseCurrencyValue(value);
  if (!cleaned) return '';
  const [whole, decimal] = cleaned.split('.');
  const formattedWhole = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  return decimal !== undefined ? `${formattedWhole}.${decimal.slice(0, 2)}` : formattedWhole;
};

export const currencyInputChange = setter => event => {
  const formatted = formatCurrencyInput(event.target.value);
  setter(formatted);
};
