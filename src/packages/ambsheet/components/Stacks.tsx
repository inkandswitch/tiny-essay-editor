import React, { useMemo } from 'react';
import { FilteredResultsForCell, Value } from '../eval';
import { groupBy } from 'lodash';
import { FilterSelection } from './AmbSheet';
import { Position } from '../datatype';

export const Stacks = ({
  selectedCell,
  results,
  filterSelection,
  setFilterSelectionForCell,
}: {
  selectedCell: Position;
  results: { value: Value; include: boolean }[];
  filterSelection: FilterSelection;
  setFilterSelectionForCell: (
    cell: Position,
    selectedIndexes: number[]
  ) => void;
}) => {
  const groupedValues = useMemo(() => {
    return groupBy(
      results.map((v, i) => ({ ...v, indexInCell: i })),
      (value) => value.value.rawValue
    );
  }, [results]);

  const selectGroup = (groupValue: any) => {
    const group = groupedValues[groupValue];
    if (!group) return;
    const selectedIndexes = group.map((v) => v.indexInCell);
    setFilterSelectionForCell(selectedCell, selectedIndexes);
  };

  if (Object.keys(groupedValues).length > 15) {
    return (
      <div className="text-xs text-gray-400">
        Too many distinct values to show Stacks
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {Object.entries(groupedValues).map(([key, values]) => {
        const stackSize = Math.min(values.length, 4);
        return (
          <div
            key={key}
            className={`w-10 relative cursor-default ${
              values.length > 1 ? 'h-10' : 'h-8'
            }`}
            onMouseEnter={() => selectGroup(key)}
            onMouseLeave={() => setFilterSelectionForCell(selectedCell, null)}
          >
            <div className="h-7">
              {Array.from({ length: stackSize }, (_, index) => {
                const selected = filterSelection?.selectedValueIndexes.includes(
                  values[index].indexInCell
                );
                const greyedOut = values.every((v) => !v.include);
                return (
                  <div
                    key={index}
                    className={`absolute shadow-sm px-3 rounded-md border border-gray-200 ${
                      selected ? 'bg-blue-100' : 'bg-white'
                    } ${greyedOut ? 'text-gray-300' : ''}`}
                    style={{
                      transform: `translate(${index * 2}px, -${index * 2}px)`,
                    }}
                  >
                    {key}
                  </div>
                );
              })}
            </div>

            {values.length > 1 && (
              <div className="text-xs text-gray-400 text-center">
                x{values.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
