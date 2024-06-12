import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { next as A } from "@automerge/automerge";
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import { HyperFormula } from "hyperformula";
import { useMemo } from "react";
import { EditorProps, Tool } from "@/os/tools";
import { registerRenderer, textRenderer } from "handsontable/renderers";
import { DataGridDoc, DataGridDocAnchor, dataGridDatatype } from "./datatype";
import { Sheet } from "lucide-react";

// register Handsontable's modules
registerAllModules();

registerRenderer("addedCell", (hotInstance, TD, ...rest) => {
  textRenderer(hotInstance, TD, ...rest);

  TD.style.outline = "solid 1px rgb(0 100 0 / 80%)";
  TD.style.background = "rgb(0 255 0 / 10%)";
});

export const DataGrid = ({
  docUrl,
  docHeads,
  annotations = [],
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

  const cellAnnotations = annotations.map((annotation) => ({
    row: annotation.anchor.row,
    col: annotation.anchor.column,
    renderer: "addedCell",
  }));

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

export const dataGridTool: Tool = {
  type: "patchwork:tool",
  name: "Spreadsheet",
  icon: Sheet,
  supportedDataTypes: [dataGridDatatype],
  editorComponent: DataGrid,
};
