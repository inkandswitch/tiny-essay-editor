import { EditorProps } from "@/os/tools";
import { isValidAutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import ReactJson from "@microlink/react-json-view";
import { useCallback } from "react";
import "react-error-boundary";

export const JSONEditor: React.FC<EditorProps<never, never>> = ({ docUrl }) => {
  const [doc, changeDoc] = useDocument(docUrl);

  /*
  const onSelectAutomergeUrl = useCallback(
    (url) => {
      setHistory([documentUrl, ...history]);
      changeDocumentUrl(url);
    },
    [history, setHistory, changeDocumentUrl]
  );
  */

  const onEdit = useCallback(
    (args) => {
      const { namespace, new_value, name } = args;
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

  const onSelect = useCallback(function (arg) {
    console.log("select", arg);
    const { value } = arg;
    if (!(typeof value === "string")) {
      return;
    }

    if (isValidAutomergeUrl(value)) {
      //onSelectAutomergeUrl(value);
    }
  }, []);

  if (!doc) {
    return;
  }

  return (
    <div className="h-full w-full overflow-auto px-5 py-4">
      <ReactJson
        collapsed={3}
        src={doc}
        onEdit={onEdit}
        onAdd={onAdd}
        onDelete={onDelete}
        onSelect={onSelect}
      />
    </div>
  );
};
