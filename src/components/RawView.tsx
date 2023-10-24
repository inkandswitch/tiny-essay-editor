import { ChangeFn } from "@automerge/automerge/next";
import { MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback } from "react";
import { Button } from "./ui/button";
import { next as A } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { useHandle } from "@automerge/automerge-repo-react-hooks";

export const RawView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  handle: DocHandle<MarkdownDoc>;
}> = ({ doc, changeDoc, handle }) => {
  useHandle(handle.url);
  console.log("render the raw view");
  const resolveAllComments = () => {
    changeDoc((doc: MarkdownDoc) => {
      A.splice(doc, ["content"], 0, 0, "hi");
      for (const threadId in doc.commentThreads) {
        const thread = doc.commentThreads[threadId];
        thread.resolved = true;
      }
    });
  };

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
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen">
      <div className="flex h-full">
        <div className="w-1/2 border-r border-gray-300 p-2">
          <div className="h-10 text-center p-2 font-mono bg-gray-100">
            Document Contents
          </div>
          <div className="p-4">
            <ReactJson
              collapsed={2}
              src={doc}
              onEdit={onEdit}
              onAdd={onAdd}
              onDelete={onDelete}
            />
          </div>
        </div>
        <div className="w-1/2 p-2">
          <div className="h-10 text-center p-2 font-mono bg-gray-100">
            Actions
          </div>
          <div className="p-4">
            <Button onClick={() => resolveAllComments()}>
              Resolve All Comments
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
