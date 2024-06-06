import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { DataGridDoc, DataGridDocAnchor } from "@/datatypes/datagrid";

import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import { HyperFormula } from "hyperformula";
import "handsontable/dist/handsontable.full.min.css";
import { useMemo } from "react";

import * as A from "@automerge/automerge/next";
import { registerRenderer, textRenderer } from "handsontable/renderers";
import { EditorProps } from "@/os/tools";

// register Handsontable's modules
registerAllModules();

registerRenderer("addedCell", (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = "solid 1px rgb(0 100 0 / 80%)";
  TD.style.background = "rgb(0 255 0 / 10%)";
});

registerRenderer("deletedCell", (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = "solid 1px rgb(100 0 0 / 80%)";
  TD.style.background = "rgb(255 0 0 / 10%)";
});

registerRenderer("highlightedCell", (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = "solid 1px rgb(200 200 0 / 80%)"; // Changed to yellow outline
  TD.style.background = "rgb(255 255 0 / 20%)"; // Changed to light yellow background
});

export const DataGrid = ({
  docUrl,
  docHeads,
  annotations = [],
  setSelectedAnchors,
}: EditorProps<DataGridDocAnchor, string>) => {
  const [latestDoc] = useDocument<DataGridDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<DataGridDoc>(docUrl);

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
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

  const cellAnnotations = annotations.map((annotation) => {
    let renderer;
    if (annotation.type === "added") {
      renderer = "addedCell";
    } else if (annotation.type === "deleted") {
      renderer = "deletedCell";
    } else if (annotation.type === "highlighted") {
      renderer = "highlightedCell";
    }
    return {
      row: annotation.anchor.row,
      col: annotation.anchor.column,
      renderer,
    };
  });

  if (!doc) {
    return null;
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <HotTable
        data={doc.data}
        beforeChange={onBeforeHotChange}
        beforeCreateRow={onBeforeCreateRow}
        beforeCreateCol={onBeforeCreateCol}
        afterSelection={(row, col) =>
          setSelectedAnchors([{ row, column: col }])
        }
        rowHeaders={true}
        colHeaders={true}
        contextMenu={true}
        width="100%"
        height="100%"
        autoWrapRow={false}
        autoWrapCol={false}
        licenseKey="non-commercial-and-evaluation"
        formulas={{ engine: HyperFormula }}
        cell={cellAnnotations}
      />
    </div>
  );
};
