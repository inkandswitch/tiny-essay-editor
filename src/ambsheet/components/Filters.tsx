import { DocHandle } from '@automerge/automerge-repo';
import { useMemo, useState } from 'react';
import { AmbSheetDoc, Position } from '../datatype';
import { Results, NOT_READY, Value } from '../eval';
import { displayNameForCell } from '../print';
import { FilterSelection } from './AmbSheet';
import { groupBy, uniq } from 'lodash';
import { printRawValue } from '../print';

export const Filters = ({
  handle,
  selectedCell,
  filterSelection,
  setFilterSelectionForCell,
  evaluatedSheet,
}: {
  handle: DocHandle<AmbSheetDoc>;
  selectedCell: Position;
  filterSelection: FilterSelection[];
  setFilterSelectionForCell: (
    cell: Position,
    selection: number[] | null
  ) => void;
  evaluatedSheet: Results;
}) => {
  const filterableCells = useMemo(() => {
    const positions = [];
    for (let row = 0; row < evaluatedSheet.length; row++) {
      for (let col = 0; col < evaluatedSheet[row].length; col++) {
        const cellResults = evaluatedSheet[row][col];
        if (Array.isArray(cellResults) && cellResults.length > 1) {
          positions.push({ row, col });
        }
      }
    }
    return positions;
  }, [evaluatedSheet]);

  const inputAmbCells = useMemo(
    () =>
      uniq(
        evaluatedSheet?.flatMap((row) =>
          row.flatMap((cell) =>
            !cell || cell === NOT_READY
              ? []
              : (cell as Value[]).flatMap((v) => [...v.context.keys()])
          )
        )
      ).map((node) => node.pos),
    [evaluatedSheet]
  );

  const outputCells = useMemo(
    () =>
      filterableCells.filter(
        (cell) =>
          !inputAmbCells.find(
            (inputCell) =>
              inputCell.row === cell.row && inputCell.col === cell.col
          )
      ),
    [filterableCells, inputAmbCells]
  );

  return (
    <div>
      <div className="h-3 text-gray-600 px-1 text-xs">
        {filterSelection.length > 0 && (
          <div>
            {filterSelection.length} filters{' '}
            <span
              onClick={() => {
                for (const f of filterSelection) {
                  setFilterSelectionForCell({ row: f.row, col: f.col }, null);
                }
              }}
              className="underline text-gray-500 cursor-pointer"
            >
              Clear
            </span>
          </div>
        )}
      </div>

      <div className="text-sm font-medium text-gray-800 uppercase mt-3 mb-1 px-1">
        Inputs
      </div>
      {inputAmbCells.map((cell) => (
        <FiltersForCell
          key={displayNameForCell(cell)}
          handle={handle}
          cell={cell}
          evaluatedSheet={evaluatedSheet}
          filterSelection={filterSelection}
          setFilterSelectionForCell={setFilterSelectionForCell}
        />
      ))}
      <div className="text-sm font-medium text-gray-800 uppercase mt-3 mb-1 px-1">
        Outputs
      </div>
      {outputCells.map((cell) => (
        <FiltersForCell
          key={displayNameForCell(cell)}
          handle={handle}
          cell={cell}
          evaluatedSheet={evaluatedSheet}
          filterSelection={filterSelection}
          setFilterSelectionForCell={setFilterSelectionForCell}
        />
      ))}
    </div>
  );
};

const FiltersForCell = ({
  handle,
  cell,
  evaluatedSheet,
  filterSelection,
  setFilterSelectionForCell,
}: {
  handle: DocHandle<AmbSheetDoc>;
  cell: Position;
  evaluatedSheet: Results;
  filterSelection: FilterSelection[];
  setFilterSelectionForCell: (
    cell: Position,
    selection: number[] | null
  ) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const values = useMemo(() => {
    return evaluatedSheet[cell.row][cell.col];
  }, [evaluatedSheet, cell]);

  const groupedValues = useMemo(() => {
    if (!Array.isArray(values)) return {};
    return groupBy(
      values.map((v, i) => ({ ...v, indexInCell: i })),
      (value) => printRawValue(value.rawValue)
    );
  }, [values]);

  const selectGroup = (groupValue: any) => {
    const group = groupedValues[groupValue];
    if (!group) return;
    const selectedIndexes = group.map((v) => v.indexInCell);

    // Retrieve the current selection for the cell, if any
    const currentSelection =
      filterSelection.find((f) => f.row === cell.row && f.col === cell.col)
        ?.selectedValueIndexes || [];

    // Combine the current selection with the new indexes, ensuring uniqueness
    const combinedSelection = Array.from(
      new Set([...currentSelection, ...selectedIndexes])
    );

    setFilterSelectionForCell(cell, combinedSelection);
  };

  const deselectGroup = (groupValue: any) => {
    const group = groupedValues[groupValue];
    if (!group) return;
    const deselectedIndexes = group.map((v) => v.indexInCell);

    // Retrieve the current selection for the cell, if any
    const currentSelection =
      filterSelection.find((f) => f.row === cell.row && f.col === cell.col)
        ?.selectedValueIndexes || [];

    // Remove the deselected indexes from the current selection
    const updatedSelection = currentSelection.filter(
      (index) => !deselectedIndexes.includes(index)
    );

    setFilterSelectionForCell(
      cell,
      updatedSelection.length > 0 ? updatedSelection : null
    );
  };

  const filterForCell = filterSelection.find(
    (f) => f.row === cell.row && f.col === cell.col
  );

  const groups = useMemo(() => {
    const items = Object.entries(groupedValues);
    if (expanded) return items;
    return items.slice(0, 5);
  }, [groupedValues, expanded]);

  return (
    <div>
      <div className="text-sm font-medium text-gray-700 bg-gray-100 px-1 mb-1">
        {displayNameForCell(cell, handle.docSync().cellNames)}
      </div>
      <div className="px-1">
        {groups.map(([groupValue, groupItems]) => {
          // This group is shown as selected if any value in the group is allowed by the filter
          const thisGroupSelected = filterForCell?.selectedValueIndexes?.some(
            (index) => groupItems.find((v) => v.indexInCell === index)
          );

          const thisGroupGreyedOut =
            filterForCell &&
            filterForCell.selectedValueIndexes?.every(
              (index) => !groupItems.find((v) => v.indexInCell === index)
            );

          return (
            <div key={groupValue} className="flex items-center mb-2">
              <input
                type="checkbox"
                id={`group-${groupValue}`}
                name="value-group"
                value={groupValue}
                onChange={(e) =>
                  e.target.checked
                    ? selectGroup(groupValue)
                    : deselectGroup(groupValue)
                }
                checked={thisGroupSelected}
                className={`w-4 h-4 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2`}
              />
              <label
                htmlFor={`group-${groupValue}`}
                className={`ml-2 text-sm  ${
                  thisGroupGreyedOut ? 'text-gray-400' : 'text-gray-900'
                } dark:text-gray-300`}
              >
                {groupValue} ({groupItems.length})
              </label>
            </div>
          );
        })}
      </div>
      {!expanded && Object.entries(groupedValues).length > 5 && (
        <button
          onClick={() => setExpanded(true)}
          className="px-1 text-sm font-medium text-gray-600"
        >
          + Show {Object.entries(groupedValues).length - 5} more
        </button>
      )}
      {expanded && Object.entries(groupedValues).length > 5 && (
        <button
          onClick={() => setExpanded(false)}
          className="px-1 text-sm font-medium text-gray-600"
        >
          Show less
        </button>
      )}
    </div>
  );
};
