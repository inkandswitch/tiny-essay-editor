import { ASError, RawValue } from './datatype';

function roundNumber(num) {
  // Rounding to 4 significant figures
  if (num === 0) return '0';
  const order = Math.floor(Math.log10(Math.abs(num)));
  const scale = Math.pow(10, 3 - order);
  const scaledNum = Math.round(num * scale);
  const roundedNum = scaledNum / scale;

  return roundedNum;
}

function formatNumber(num) {
  // Formatting with commas
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 10, // Handle fractional digits correctly
  });
  return formatter.format(num);
}

export const printRawValue = (value: RawValue): string => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return formatNumber(roundNumber(value));
    }
    return formatNumber(value);
  } else {
    return value.toString();
  }
};