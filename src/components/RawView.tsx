import { ChangeFn } from "@automerge/automerge/next";
import { MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";

import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { mapValues } from "lodash";
import { MarkdownDocActions } from "@/MarkdownDoc";
import { editDocument } from "../llm";
import { llmTools } from "@/prompts";

export const RawView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
}> = ({ doc, changeDoc }) => {
  const [actionParams, setActionParams] = useState<{
    [key: string]: { [key: string]: any };
  }>(
    mapValues(MarkdownDocActions, (params) =>
      mapValues(params.parameters.properties, ({ type }) =>
        type === "string" ? "" : type === "number" ? 0 : false
      )
    )
  );

  const onEdit = useCallback(
    ({
      namespace,
      new_value,
      name,
    }: {
      namespace: any;
      new_value?: any;
      name: any;
    }) => {
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

  const runLLM = async (prompt: string) => {
    const result = await editDocument(prompt, doc);
    if (result._type === "error") {
      throw new Error(`LLM had an error...`);
    }
    const edits = result.result.edits;

    for (const edit of edits) {
      const action = MarkdownDocActions[edit.action];
      if (!action) {
        throw new Error(`Unexpected action returned by LLM: ${action}`);
      }
      action.executeFn(doc, edit.parameters);
    }
  };

  if (!doc) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-1/2 border-r border-gray-300 h-full">
        <div className=" px-2 py-1 bg-gray-100 text-sm">Document Contents</div>
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
      <div className="w-1/2">
        <div className=" px-2 py-1  bg-gray-100  text-sm">Actions</div>
        <div className="p-4">
          {Object.entries(MarkdownDocActions).map(([action, config]) => (
            <div className="my-2 p-4 border bg-gray-100 border-gray-200 rounded-sm">
              {Object.entries(config.parameters.properties).map(
                ([param, { type }]) => (
                  <div key={param} className="mb-2 flex gap-1">
                    <Label className="w-36 pt-3" htmlFor={param}>
                      {param}
                    </Label>
                    <Input
                      id={param}
                      value={actionParams[action][param]}
                      type={
                        type === "number"
                          ? "number"
                          : type === "string"
                          ? "text"
                          : "checkbox"
                      }
                      onChange={(e) => {
                        setActionParams((params) => ({
                          ...params,
                          [action]: {
                            ...params[action],
                            [param]:
                              type === "number"
                                ? parseInt(e.target.value) ?? 0
                                : type === "string"
                                ? e.target.value
                                : e.target.checked ?? false,
                          },
                        }));
                      }}
                    />
                  </div>
                )
              )}
              <Button
                onClick={() => {
                  changeDoc((doc) =>
                    config.executeFn(doc, actionParams[action])
                  );
                  actionParams[action] = mapValues(
                    MarkdownDocActions[action].parameters.properties,
                    ({ type }) =>
                      type === "string" ? "" : type === "number" ? 0 : false
                  );
                }}
              >
                {action}
              </Button>
            </div>
          ))}
        </div>
        <div>
          <div className=" px-2 py-1 bg-gray-100 text-sm">LLM Tools</div>
          <div className="p-4">
            {llmTools.map((tool) => (
              <div>
                <Button onClick={() => runLLM(tool.prompt)}>{tool.name}</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
