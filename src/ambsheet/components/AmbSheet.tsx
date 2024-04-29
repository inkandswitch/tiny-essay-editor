import { useDocument, useHandle } from '@automerge/automerge-repo-react-hooks';
import { AmbSheetDoc, AmbSheetDocAnchor } from '../datatype';

import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { useEffect, useMemo, useState } from 'react';

import * as A from '@automerge/automerge/next';
import { registerRenderer, textRenderer } from 'handsontable/renderers';
import { DocEditorProps } from '@/DocExplorer/doctypes';
import { AmbContext, NOT_READY, Value, evalSheet, filter } from '../eval';
import { FormulaEditor } from '../formulaEditor';
import { isFormula } from '../parse';
import React from 'react';
import { Stacks } from './Stacks';
import { RawViewer } from './RawViewer';

// register Handsontable's modules
registerAllModules();

registerRenderer('addedCell', (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = 'solid 1px rgb(0 100 0 / 80%)';
  TD.style.background = 'rgb(0 255 0 / 10%)';
});

registerRenderer(
  'amb',
  (instance, td, row, col, prop, value, cellProperties) => {
    const selectedValueIndexes =
      instance.getCellMeta(row, col)['selectedValueIndexes'] || [];
    if (value === null) {
      td.innerText = '';
      return td;
    }

    if (value === NOT_READY) {
      // todo: is this right? need to consider when NOT_READY gets returned...
      td.innerText = '!ERROR';
      return td;
    }

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.justifyContent = 'flex-start';
    container.style.alignItems = 'center';
    container.style.fontSize = '16px';

    // Adjusting styles to compensate for removed gap
    container.className = 'value-container';
    const style = document.createElement('style');
    style.innerHTML = `
      .value-container::after {
        content: '';
        height: 100%;
        border-right: 1px solid #ddd;
      }
      .value-container > div:not(:last-child)::after {
        content: '';
        position: absolute;
        right: 0; /* adjusted for removed gap */
        height: 100%;
        border-right: 1px solid #ddd;
      }
      .value-container > div {
        position: relative;
      }
    `;
    document.head.appendChild(style);

    value.forEach((val, i) => {
      const valueElement = document.createElement('div');
      valueElement.innerText = val.value.rawValue;
      valueElement.style.padding = '1px 4px';
      valueElement.setAttribute('data-context', JSON.stringify(val.context));
      if (!val.include) {
        valueElement.style.color = '#ddd';
      }
      if (selectedValueIndexes.includes(i)) {
        valueElement.style.background = 'rgb(255 0 0 / 10%)';
      }
      valueElement.addEventListener('click', () => {
        const valueIndex = selectedValueIndexes.indexOf(i);
        if (valueIndex > -1) {
          selectedValueIndexes.splice(valueIndex, 1); // Remove the value if it's already in the array
        } else {
          selectedValueIndexes.push(i); // Add the value if it's not in the array
        }
        instance.setCellMeta(
          row,
          col,
          'selectedValueIndexes',
          selectedValueIndexes
        );
      });
      container.appendChild(valueElement);
    });
    td.innerHTML = '';
    td.appendChild(container);

    return td;
  }
);

export type CellSelection = {
  row: number;
  col: number;
};

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
  annotations = [],
}: DocEditorProps<AmbSheetDocAnchor, string>) => {
  const [latestDoc] = useDocument<AmbSheetDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<AmbSheetDoc>(docUrl);
  const [selectedCell, setSelectedCell] = useState<CellSelection | undefined>(
    undefined
  );

  const [filteredValues, setFilteredValues] = useState<FilterSelection[]>([]);

  const filterSelectionForSelectedCell = useMemo(() => {
    return filteredValues.find(
      (f) => f.row === selectedCell.row && f.col === selectedCell.col
    );
  }, [filteredValues, selectedCell]);

  const selectedCellName = selectedCell
    ? `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}`
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

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full flex">
      <div className="w-3/4 h-full overflow-auto">
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
      <div className="w-1/4 h-full overflow-auto p-2">
        <div>Cell {selectedCellName}</div>

        {selectedCellResult && selectedCellResult !== NOT_READY && (
          <div>
            <div className="my-2">
              <h2>Stacks</h2>
              <Stacks
                values={selectedCellResult as Value[]}
                filterSelection={filterSelectionForSelectedCell}
                setFilterSelection={(selection: FilterSelection) => {
                  setFilteredValues((filteredValues) => {
                    const index = filteredValues.findIndex(
                      (f) => f.row === selection.row && f.col === selection.col
                    );
                    if (index === -1) {
                      return [...filteredValues, selection];
                    }
                    return filteredValues.map((f) =>
                      f.row === selection.row && f.col === selection.col
                        ? selection
                        : f
                    );
                  });
                }}
              />
            </div>
            <div className="my-2">
              <h2>Raw</h2>
              <RawViewer values={selectedCellResult as Value[]} />
            </div>
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
