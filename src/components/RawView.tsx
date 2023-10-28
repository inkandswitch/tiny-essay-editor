import { ChangeFn } from "@automerge/automerge/next";
import { MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";

import { DocHandle } from "@automerge/automerge-repo";
import { useHandle } from "@automerge/automerge-repo-react-hooks";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { mapValues } from "lodash";
import { MarkdownDocActions } from "@/MarkdownDoc";

export const RawView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  handle: DocHandle<MarkdownDoc>;
}> = ({ doc, changeDoc, handle }) => {
  useHandle(handle.url);

  const [actionParams, setActionParams] = useState<{
    [key: string]: { [key: string]: any };
  }>(
    mapValues(MarkdownDocActions, (params) =>
      mapValues(params.params, (paramType) =>
        paramType === "string" ? "" : paramType === "number" ? 0 : false
      )
    )
  );

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

  const runLLM = () => {
    console.log("yo");
  };

  if (!doc) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen">
      <div className="flex h-full">
        <div className="w-1/2 border-r border-gray-300 p-2">
          <div className="text-center p-1 font-mono bg-gray-100">
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
          <div className=" text-center p-1 font-mono bg-gray-100">Actions</div>
          <div className="p-4">
            <Button onClick={runLLM}>Academish Voice Check</Button>
            {Object.entries(MarkdownDocActions).map(([action, config]) => (
              <div className="my-2 p-4 border border-gray-400 rounded-md">
                {Object.entries(config.params).map(([param, paramType]) => (
                  <div key={param} className="mb-2 flex gap-1">
                    <Label className="w-36 pt-3" htmlFor={param}>
                      {param}
                    </Label>
                    <Input
                      id={param}
                      value={actionParams[action][param]}
                      type={
                        paramType === "number"
                          ? "number"
                          : paramType === "string"
                          ? "text"
                          : "checkbox"
                      }
                      onChange={(e) => {
                        setActionParams((params) => ({
                          ...params,
                          [action]: {
                            ...params[action],
                            [param]:
                              paramType === "number"
                                ? parseInt(e.target.value) ?? 0
                                : paramType === "string"
                                ? e.target.value
                                : e.target.checked ?? false,
                          },
                        }));
                      }}
                    />
                  </div>
                ))}
                <Button
                  onClick={() => {
                    changeDoc((doc) =>
                      config.action(doc, actionParams[action])
                    );
                    actionParams[action] = mapValues(
                      MarkdownDocActions[action].params,
                      (paramType) =>
                        paramType === "string"
                          ? ""
                          : paramType === "number"
                          ? 0
                          : false
                    );
                  }}
                >
                  {action}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
