import { DocHandle } from '@automerge/automerge-repo';
import { useMemo } from 'react';
import { AmbSheetDoc, Position } from '../datatype';
import { Results, NOT_READY, Value } from '../eval';
import { cellPositionToName } from '../parse';
import { RawViewer } from './RawViewer';
import { Stacks } from './Stacks';
import { TableViewer } from './TableViewer';
import { FilterSelection } from './AmbSheet';

export const CellDetails = ({
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
  const filterSelectionForSelectedCell = useMemo(() => {
    return filterSelection.find(
      (f) => f.row === selectedCell.row && f.col === selectedCell.col
    );
  }, [filterSelection, selectedCell]);

  const selectedCellName = selectedCell
    ? cellPositionToName(selectedCell)
    : undefined;

  const selectedCellResult = useMemo(() => {
    if (!selectedCell) {
      return undefined;
    }
    return evaluatedSheet[selectedCell.row][selectedCell.col];
  }, [selectedCell, evaluatedSheet]);

  return (
    <div className="flex flex-col gap-4">
      <div className="">
        <label
          htmlFor="cellContent"
          className="block text-xs text-gray-500 font-bold uppercase mb-3"
        >
          Cell {selectedCellName}
        </label>
        <input
          type="text"
          id="cellContent"
          name="cellContent"
          value={handle.docSync().data[selectedCell.row][selectedCell.col]}
          onChange={(e) =>
            handle.change((d) => {
              d.data[selectedCell.row][selectedCell.col] = e.target.value;
            })
          }
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
            Stacks
          </h2>
          <Stacks
            selectedCell={selectedCell}
            values={selectedCellResult as Value[]}
            filterSelection={filterSelectionForSelectedCell}
            setFilterSelectionForCell={setFilterSelectionForCell}
          />
        </div>
      )}
      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
            Table
          </h2>
          <TableViewer
            selectedCell={selectedCell}
            values={selectedCellResult as Value[]}
            filterSelection={filterSelectionForSelectedCell}
            setFilterSelectionForCell={setFilterSelectionForCell}
            evaluatedSheet={evaluatedSheet}
          />
        </div>
      )}
      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
            Raw
          </h2>
          <RawViewer values={selectedCellResult as Value[]} />
        </div>
      )}
    </div>
  );
};