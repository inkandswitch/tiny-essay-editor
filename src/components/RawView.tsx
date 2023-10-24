import { ChangeFn } from "@automerge/automerge/next";
import { MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback } from "react";

export const RawView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
}> = ({ doc, changeDoc }) => {
  const onEdit = useCallback(
    ({ namespace, new_value, name }) => {
      changeDoc(function (doc) {
        let current = doc;
        for (
          let _i = 0, namespace_1 = namespace;
          _i < namespace_1.length;
          _i++
        ) {
          const key = namespace_1[_i];
          current = current[key];
        }
        current[name] = new_value;
      });
    },
    [changeDoc]
  );

  const onAdd = useCallback(function () {
    return true;
  }, []);

  const onDelete = useCallback(
    function ({ namespace, name }) {
      changeDoc(function (doc) {
        let current = doc;
        for (
          let _i = 0, namespace_2 = namespace;
          _i < namespace_2.length;
          _i++
        ) {
          const key = namespace_2[_i];
          current = current[key];
        }
        delete current[name];
      });
    },
    [changeDoc]
  );

  if (!doc) {
    return <div>Loading {documentUrl}...</div>;
  }

  return (
    <ReactJson
      collapsed={2}
      src={doc}
      onEdit={onEdit}
      onAdd={onAdd}
      onDelete={onDelete}
    />
  );
};
