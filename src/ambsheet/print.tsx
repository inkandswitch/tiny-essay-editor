import { ASError, CellName, Position, RawValue } from './datatype';
import React from 'react';
import { Env } from './eval';

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

export const printRawValue = (value: RawValue): string | JSX.Element => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return formatNumber(roundNumber(value));
    }
    return formatNumber(value);
  } else if (value['type'] === 'rgb') {
    return (
      <div
        className="w-5 h-5"
        style={{
          backgroundColor: `rgb(${value['r']}, ${value['g']}, ${value['b']})`,
        }}
      />
    );
  } else {
    return value.toString();
  }
}; // Get a human readable cell name like B2 given a row and col.
// Might extend this in the future to support custom cell names?

export const displayNameForCell = (pos: Position, sheet?: Env) => {
  const explicitName = sheet?.getCellNameAt(pos);
  const simpleName = simpleNameForCell(pos);

  if (explicitName) {
    return `${explicitName} (${simpleName})`;
  }
  return simpleName;
};

export const simpleNameForCell = (pos: Position) => {
  return `${String.fromCharCode(65 + pos.col)}${pos.row + 1}`;
};
