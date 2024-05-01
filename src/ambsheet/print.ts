import { RawValue } from './datatype';

export const printRawValue = (value: RawValue): string => {
  if (typeof value === 'number') {
    return value.toPrecision(4).toString();
  } else {
    return value;
  }
};
