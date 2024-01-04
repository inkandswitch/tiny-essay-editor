import React, { useCallback } from "react";
import ReactJson, { InteractionProps } from "@microlink/react-json-view";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import "react-error-boundary";

import { AutomergeUrl } from "@automerge/automerge-repo";

export function RawView({ documentUrl }: { documentUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument(documentUrl);

  const onEdit = useCallback(
    ({ namespace, new_value, name }: InteractionProps) => {
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
    <div>
      <ReactJson
        collapsed={3}
        src={doc}
        onEdit={onEdit}
        onAdd={onAdd}
        onDelete={onDelete}
      />
    </div>
  );
}
