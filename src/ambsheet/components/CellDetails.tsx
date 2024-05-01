import { DocHandle } from '@automerge/automerge-repo';
import { useEffect, useMemo, useState } from 'react';
import { AmbSheetDoc, Position } from '../datatype';
import { NOT_READY, Value, FilteredResults } from '../eval';
import { displayNameForCell } from '../print';
import { RawViewer } from './RawViewer';
import { Stacks } from './Stacks';
import { TableViewer } from './TableViewer';
import { FilterSelection } from './AmbSheet';
import { ResultHistogram } from './ResultHistogram';
import { useDocument } from '@/useDocumentVendored';

export const CellDetails = ({
  handle,
  selectedCell,
  filterSelection,
  setFilterSelectionForCell,
  filteredResults,
}: {
  handle: DocHandle<AmbSheetDoc>;
  selectedCell: Position;
  filterSelection: FilterSelection[];
  setFilterSelectionForCell: (
    cell: Position,
    selection: number[] | null
  ) => void;
  filteredResults: FilteredResults;
}) => {
  const [doc] = useDocument<AmbSheetDoc>(handle.url);
  const filterSelectionForSelectedCell = useMemo(() => {
    return filterSelection.find(
      (f) => f.row === selectedCell.row && f.col === selectedCell.col
    );
  }, [filterSelection, selectedCell]);

  const selectedCellResult = useMemo(() => {
    const cellResults = filteredResults[selectedCell.row][selectedCell.col];
    if (cellResults === null || cellResults === NOT_READY) {
      return undefined;
    }
    return cellResults as { value: Value; include: boolean }[];
  }, [selectedCell, filteredResults]);

  const [cellName, setCellName] = useState<string>(
    doc?.cellNames.find(
      (c) => c.row === selectedCell.row && c.col === selectedCell.col
    )?.name ?? ''
  );
  const [cellContent, setCellContent] = useState<string>(
    doc?.data[selectedCell.row][selectedCell.col]
  );

  useEffect(() => {
    setCellName(
      doc?.cellNames.find(
        (c) => c.row === selectedCell.row && c.col === selectedCell.col
      )?.name ?? ''
    );
    setCellContent(doc?.data[selectedCell.row][selectedCell.col]);
  }, [selectedCell, doc?.cellNames, doc?.data]);

  const onSubmitName = (e) =>
    handle.change((d) => {
      const existingName = d.cellNames.find(
        (c) => c.row === selectedCell.row && c.col === selectedCell.col
      );
      if (existingName && e.target.value.length > 0) {
        existingName.name = e.target.value;
      } else if (existingName && e.target.value.length === 0) {
        d.cellNames.splice(d.cellNames.indexOf(existingName), 1);
      } else {
        d.cellNames.push({
          row: selectedCell.row,
          col: selectedCell.col,
          name: e.target.value,
        });
      }
    });

  const onSubmitContent = (e) =>
    handle.change((d) => {
      d.data[selectedCell.row][selectedCell.col] = e.target.value;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-gray-500 font-bold uppercase">
        Cell Details
      </div>
      <div className="">
        <div className="text-xs">Name</div>
        <input
          type="text"
          id="cellName"
          name="cellName"
          value={cellName}
          placeholder={displayNameForCell(selectedCell, doc?.cellNames)}
          onChange={(e) => setCellName(e.target.value)}
          onBlur={onSubmitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              onSubmitName(e);
            }
          }}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-2 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="">
        <div className="text-xs">Content</div>
        <input
          type="text"
          id="cellContent"
          name="cellContent"
          value={cellContent}
          onChange={(e) => setCellContent(e.target.value)}
          onBlur={onSubmitContent}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              onSubmitContent(e);
            }
          }}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-2 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase">
            Histogram
          </h2>
          <ResultHistogram
            selectedCell={selectedCell}
            results={selectedCellResult}
            filterSelection={filterSelectionForSelectedCell}
            setFilterSelectionForCell={setFilterSelectionForCell}
          />
        </div>
      )}

      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase">Table</h2>
          <TableViewer
            doc={doc}
            selectedCell={selectedCell}
            results={selectedCellResult}
            filterSelection={filterSelectionForSelectedCell}
            setFilterSelectionForCell={setFilterSelectionForCell}
            filteredResults={filteredResults}
          />
        </div>
      )}
      {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
            Stacks
          </h2>
          <Stacks
            selectedCell={selectedCell}
            results={selectedCellResult}
            filterSelection={filterSelectionForSelectedCell}
            setFilterSelectionForCell={setFilterSelectionForCell}
          />
        </div>
      )}
      {/* {selectedCellResult && selectedCellResult !== NOT_READY && (
        <div className="">
          <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
            Raw
          </h2>
          <RawViewer values={selectedCellResult as Value[]} />
        </div>
      )} */}
    </div>
  );
};
