import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { DataGridDoc } from "../schema";

import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.min.css";
import { useEffect, useRef } from "react";

// register Handsontable's modules
registerAllModules();

export const DataGrid = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  useDocument<DataGridDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<DataGridDoc>(docUrl);

  const hotTableComponentRef = useRef(null);

  useEffect(() => {
    const updateHotTable = ({ doc }) => {
      console.log("table changed", doc);
      // The Handsontable instance is stored under the `hotInstance` property of the wrapper component.
      if (doc.data) {
        hotTableComponentRef.current.hotInstance.updateData(doc.data);
      }
    };
    handle.on("change", updateHotTable);
    hotTableComponentRef.current.hotInstance.updateData(handle.docSync().data);
    return () => {
      handle.off("change", updateHotTable);
    };
  }, [handle]);

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

  const onBeforeCreateRow = (index, amount, source) => {
    handle.change((doc) => {
      doc.data.splice(
        index,
        0,
        ...new Array(amount).fill(new Array(doc.data[0].length).fill(null))
      );
    });
    return false;
  };

  const onBeforeCreateCol = (index, amount, source) => {
    handle.change((doc) => {
      doc.data.forEach((row) => {
        row.splice(index, 0, ...new Array(amount).fill(null));
      });
    });
    return false;
  };

  return (
    <HotTable
      ref={hotTableComponentRef}
      beforeChange={onBeforeHotChange}
      beforeCreateRow={onBeforeCreateRow}
      beforeCreateCol={onBeforeCreateCol}
      rowHeaders={true}
      colHeaders={true}
      contextMenu={true}
      height="auto"
      autoWrapRow={true}
      autoWrapCol={true}
      licenseKey="non-commercial-and-evaluation"
    />
  );
};
