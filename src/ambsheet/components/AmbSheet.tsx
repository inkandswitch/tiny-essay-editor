import { useDocument, useHandle } from '@automerge/automerge-repo-react-hooks';
import { AmbSheetDoc, AmbSheetDocAnchor, Position } from '../datatype';

import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { useEffect, useMemo, useState } from 'react';

import * as A from '@automerge/automerge/next';
import { registerRenderer, textRenderer } from 'handsontable/renderers';
import { DocEditorProps } from '@/DocExplorer/doctypes';
import { AmbContext, NOT_READY, Value, evalSheet, filter } from '../eval';
import { FormulaEditor } from '../formulaEditor';
import { cellIndexToName, isFormula } from '../parse';
import React from 'react';
import { Stacks } from './Stacks';
import { RawViewer } from './RawViewer';
import { TableViewer } from './TableViewer';
import { ambRenderer } from '../ambRenderer';

// register Handsontable's modules
registerAllModules();
registerRenderer('amb', ambRenderer);

export type FilterSelection = {
  row: number;
  col: number;
  selectedValueIndexes: number[];
};

// Here's an overview of how formula evaluation works:
// - The raw document stores cells as text, including formulas
// - The data we pass into HOT contains evaluated formula results
// - We also pass in formula text as secondary cell metadata

export const AmbSheet = ({
  docUrl,
  docHeads,
}: DocEditorProps<AmbSheetDocAnchor, string>) => {
  const [latestDoc] = useDocument<AmbSheetDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<AmbSheetDoc>(docUrl);
  const [selectedCell, setSelectedCell] = useState<Position | undefined>(
    undefined
  );

  const [filteredValues, setFilteredValues] = useState<FilterSelection[]>([]);

  const filterSelectionForSelectedCell = useMemo(() => {
    return filteredValues.find(
      (f) => f.row === selectedCell.row && f.col === selectedCell.col
    );
  }, [filteredValues, selectedCell]);

  const selectedCellName = selectedCell
    ? cellIndexToName(selectedCell)
    : undefined;

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  const evaluatedSheet = useMemo(() => {
    if (!doc) {
      return [];
    }
    return evalSheet(doc.data).results;
  }, [doc]);

  const selectedCellResult = useMemo(() => {
    if (!selectedCell) {
      return undefined;
    }
    return evaluatedSheet[selectedCell.row][selectedCell.col];
  }, [selectedCell, evaluatedSheet]);

  console.log(selectedCellResult);

  const filteredResults = useMemo(() => {
    const filterContexts = filteredValues.map((f) => {
      return f.selectedValueIndexes.map(
        (i) => evaluatedSheet[f.row][f.col][i].context
      );
    });
    return filter(evaluatedSheet, filterContexts);
  }, [evaluatedSheet, filteredValues]);

  const onBeforeHotChange = (changes) => {
    handle.change((doc) => {
      changes.forEach(([row, column, , newValue]) => {
        if (column > doc.data[0].length) {
          doc.data[0][column] = '';
        }
        if (!doc.data[row]) {
          doc.data[row] = new Array(column).fill(null);
        }
        doc.data[row][column] = newValue;
      });
    });
    return false;
  };

  const onAfterSetCellMeta = (row, col, _, value) => {
    const existingEntryIndex = filteredValues.findIndex(
      (entry) => entry.row === row && entry.col === col
    );
    if (existingEntryIndex !== -1) {
      if (value.length === 0) {
        // Clear out the existing entry if the value is an empty array
        setFilteredValues(
          filteredValues.filter((_, index) => index !== existingEntryIndex)
        );
      } else {
        // Update existing entry
        const updatedEntry = {
          ...filteredValues[existingEntryIndex],
          selectedValueIndexes: value,
        };
        const newFilterContextsForCells = [...filteredValues];
        newFilterContextsForCells[existingEntryIndex] = updatedEntry;
        setFilteredValues(newFilterContextsForCells);
      }
    } else if (value.length > 0) {
      // Add new entry only if value is not an empty array
      setFilteredValues([
        ...filteredValues,
        { row, col, selectedValueIndexes: value },
      ]);
    }
  };
  const onBeforeCreateRow = (index, amount) => {
    handle.change((doc) => {
      doc.data.splice(
        index,
        0,
        ...new Array(amount).fill(new Array(doc.data[0].length).fill(null))
      );
    });
    return false;
  };

  const onBeforeCreateCol = (index, amount) => {
    handle.change((doc) => {
      doc.data.forEach((row) => {
        row.splice(index, 0, ...new Array(amount).fill(null));
      });
    });
    return false;
  };

  const onAfterSelection = (row, col) => {
    setSelectedCell({ row, col });
  };

  const onSetSelectedValuesForSelectedCell = (selection: number[] | null) => {
    setFilteredValues((filteredValues) => {
      const index = filteredValues.findIndex(
        (f) => f.row === selectedCell.row && f.col === selectedCell.col
      );
      if (index === -1) {
        return [
          ...filteredValues,
          {
            row: selectedCell.row,
            col: selectedCell.col,
            selectedValueIndexes: selection,
          },
        ];
      }
      return filteredValues.flatMap((f) =>
        f.row === selectedCell.row && f.col === selectedCell.col
          ? selection
            ? [{ ...f, selectedValueIndexes: selection }]
            : []
          : f
      );
    });
  };

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full flex">
      <div className=" grow h-full overflow-auto">
        <MemoizedHOTWrapper
          doc={doc}
          filteredResults={filteredResults}
          filteredValues={filteredValues}
          onBeforeHotChange={onBeforeHotChange}
          onBeforeCreateRow={onBeforeCreateRow}
          onBeforeCreateCol={onBeforeCreateCol}
          onAfterSetCellMeta={onAfterSetCellMeta}
          onAfterSelection={onAfterSelection}
        />
      </div>
      <div className="w-[250px] h-full overflow-auto p-2">
        {selectedCell && (
          <div className="flex flex-col gap-4">
            <div className="">
              <label
                htmlFor="cellContent"
                className="block text-sm font-medium text-gray-700"
              >
                {selectedCellName}
              </label>
              <input
                type="text"
                id="cellContent"
                name="cellContent"
                value={doc.data[selectedCell.row][selectedCell.col]}
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
                  values={selectedCellResult as Value[]}
                  filterSelection={filterSelectionForSelectedCell}
                  setFilterSelection={onSetSelectedValuesForSelectedCell}
                />
              </div>
            )}
            {selectedCellResult && selectedCellResult !== NOT_READY && (
              <div className="">
                <h2 className="text-xs text-gray-500 font-bold uppercase mb-3">
                  Table
                </h2>
                <TableViewer
                  values={selectedCellResult as Value[]}
                  filterSelection={filterSelectionForSelectedCell}
                  setFilterSelection={onSetSelectedValuesForSelectedCell}
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
        )}
      </div>
    </div>
  );
};

// This is just a way to avoid HOT from doing expensive 100ms+ rerenders
// if the data hasn't actually changed at all.
const MemoizedHOTWrapper = React.memo(
  ({
    doc,
    filteredResults,
    filteredValues,
    onBeforeHotChange,
    onBeforeCreateRow,
    onBeforeCreateCol,
    onAfterSetCellMeta,
    onAfterSelection,
  }: {
    doc: AmbSheetDoc;
    filteredValues: any;
    filteredResults: any;
    onBeforeHotChange: any;
    onBeforeCreateRow: any;
    onBeforeCreateCol: any;
    onAfterSetCellMeta: any;
    onAfterSelection: any;
  }) => {
    return (
      <HotTable
        data={filteredResults}
        editor={FormulaEditor}
        beforeChange={onBeforeHotChange}
        beforeCreateRow={onBeforeCreateRow}
        beforeCreateCol={onBeforeCreateCol}
        afterSetCellMeta={onAfterSetCellMeta}
        afterSelection={onAfterSelection}
        rowHeaders={true}
        colHeaders={true}
        contextMenu={true}
        width="100%"
        height="100%"
        autoWrapRow={false}
        autoWrapCol={false}
        licenseKey="non-commercial-and-evaluation"
        renderer="amb"
        // Attach raw formula results to the cell metadata
        cells={(row, col) => {
          const rawContents = doc.data[row][col];
          const selectedValueIndexes =
            filteredValues.find((f) => f.row === row && f.col === col)
              ?.selectedValueIndexes || [];
          if (isFormula(rawContents)) {
            return { formula: rawContents, selectedValueIndexes };
          }
        }}
      />
    );
  },
  (prev, next) =>
    prev.filteredResults === next.filteredResults &&
    prev.filteredValues === next.filteredValues &&
    prev.doc === next.doc
);
