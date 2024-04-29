import React, { useMemo } from 'react';
import { Value } from '../eval';
import { groupBy } from 'lodash';
import { FilterSelection } from './AmbSheet';

export const Stacks = ({
  values,
  filterSelection,
  setFilterSelection,
}: {
  values: Value[];
  filterSelection: FilterSelection;
  setFilterSelection: (filterSelection: FilterSelection) => void;
}) => {
  const groupedValues = useMemo(() => {
    return groupBy(
      values.map((v, i) => ({ ...v, indexInCell: i })),
      (value) => value.rawValue
    );
  }, [values]);

  return (
    <div className="flex flex-wrap gap-2 mb-10">
      {Object.entries(groupedValues).map(([key, values]) => {
        const stackSize = Math.min(values.length, 5);
        return (
          <div key={key} className="w-10 h-8 relative cursor-default">
            <div className="text-xs text-gray-400 text-center mb-1">
              x{values.length}
            </div>
            {Array.from({ length: stackSize }, (_, index) => {
              const selected = filterSelection?.selectedValueIndexes.includes(
                values[index].indexInCell
              );
              return (
                <div
                  key={index}
                  className={`absolute shadow-sm px-3 rounded-md border border-gray-200 ${
                    selected ? 'bg-red-200' : 'bg-white'
                  }`}
                  style={{
                    transform: `translate(${index * 3}px, -${index * 3}px)`,
                  }}
                >
                  {key}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
