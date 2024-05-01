import { RawValue } from './datatype';

export const printRawValue = (value: RawValue): string => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return value.toPrecision(4).toString();
    }
    return value.toString();
  } else {
    return value;
  }
};
