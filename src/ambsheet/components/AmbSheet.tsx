import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { AmbSheetDoc, AmbSheetDocAnchor } from "../datatype";

import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import { useMemo } from "react";

import * as A from "@automerge/automerge/next";
import { registerRenderer, textRenderer } from "handsontable/renderers";
import { DocEditorProps } from "@/DocExplorer/doctypes";
import { evaluateSheet, isFormula } from "../eval";
import { FormulaEditor } from "../formulaEditor";

// register Handsontable's modules
registerAllModules();

registerRenderer("addedCell", (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = "solid 1px rgb(0 100 0 / 80%)";
  TD.style.background = "rgb(0 255 0 / 10%)";
});

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

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  const evaluatedSheet = useMemo(
    () => (doc ? evaluateSheet(doc.data) : []),
    [doc]
  );

  const onBeforeHotChange = (changes) => {
    handle.change((doc) => {
      changes.forEach(([row, column, , newValue]) => {
        if (column > doc.data[0].length) {
          doc.data[0][column] = "";
        }
        if (!doc.data[row]) {
          doc.data[row] = new Array(column).fill(null);
        }
        doc.data[row][column] = newValue;
      });
    });
    return false;
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

  const cellAnnotations = annotations.map((annotation) => ({
    row: annotation.target.row,
    col: annotation.target.column,
    renderer: "addedCell",
    formula: `=${annotation.target.row}+${annotation.target.column}`,
  }));

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <HotTable
        data={evaluatedSheet}
        editor={FormulaEditor}
        beforeChange={onBeforeHotChange}
        beforeCreateRow={onBeforeCreateRow}
        beforeCreateCol={onBeforeCreateCol}
        rowHeaders={true}
        colHeaders={true}
        contextMenu={true}
        width="100%"
        height="100%"
        autoWrapRow={false}
        autoWrapCol={false}
        licenseKey="non-commercial-and-evaluation"
        cell={cellAnnotations}
        // Attach raw formula results to the cell metadata
        cells={(row, col) => {
          const rawContents = doc.data[row][col];
          if (isFormula(rawContents)) {
            return { formula: rawContents };
          }
        }}
      />
    </div>
  );
};
