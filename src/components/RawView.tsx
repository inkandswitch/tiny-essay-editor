import { ChangeFn } from "@automerge/automerge/next";
import { LLMTool, MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";

import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { mapValues } from "lodash";
import { MarkdownDocActions } from "@/MarkdownDoc";
import { editDocument } from "../llm";
import { DEFAULT_LLM_TOOLS } from "@/prompts";
import { ActionSpec } from "@/types";

const ActionForm: React.FC<{
  action: string;
  config: ActionSpec;
  changeDoc: (fn: ChangeFn<MarkdownDoc>) => void;
}> = ({ action, config, changeDoc }) => {
  const [params, setParams] = useState<{
    [key: string]: string | number | boolean;
  }>(
    mapValues(config.parameters.properties, ({ type }) =>
      type === "string" ? "" : type === "number" ? 0 : false
    )
  );

  return (
    <div className="my-2 p-4 border bg-gray-100 border-gray-200 rounded-sm">
      {Object.entries(config.parameters.properties).map(([param, { type }]) => (
        <div key={param} className="mb-2 flex gap-1">
          <Label className="w-36 pt-3" htmlFor={param}>
            {param}
          </Label>
          <Input
            id={param}
            value={String(params[param])}
            type={
              type === "number"
                ? "number"
                : type === "string"
                ? "text"
                : "checkbox"
            }
            onChange={(e) => {
              setParams((params) => ({
                ...params,
                [param]:
                  type === "number"
                    ? parseInt(e.target.value) ?? 0
                    : type === "string"
                    ? e.target.value
                    : e.target.checked ?? false,
              }));
            }}
          />
        </div>
      ))}
      <Button
        onClick={() => {
          changeDoc((doc: MarkdownDoc) => {
            return config.executeFn(doc, params);
          });
          setParams(
            mapValues(
              MarkdownDocActions[action].parameters.properties,
              ({ type }) =>
                type === "string" ? "" : type === "number" ? 0 : false
            )
          );
        }}
      >
        {action}
      </Button>
    </div>
  );
};

const LLMToolView: React.FC<{ doc: MarkdownDoc; tool: LLMTool }> = ({
  doc,
  tool,
}) => {
  const [uiState, setUiState] = useState<"idle" | "loading" | "error">("idle");

  const runLLM = async (prompt: string) => {
    setUiState("loading");
    const result = await editDocument(prompt, doc);
    console.log("llm result", result);
    if (result._type === "error") {
      setUiState("error");
      throw new Error(`LLM had an error...`);
    }
    setUiState("idle");
    const edits = result.result.edits;

    for (const edit of edits) {
      const action = MarkdownDocActions[edit.action];
      if (!action) {
        throw new Error(`Unexpected action returned by LLM: ${action}`);
      }
      action.executeFn(doc, edit.parameters);
    }
  };
  return (
    <div>
      <Button
        disabled={uiState === "loading"}
        onClick={() => runLLM(tool.prompt)}
      >
        {tool.name}
      </Button>
      {uiState === "loading" && <div className="text-xs">Loading...</div>}
      {uiState === "error" && <div className="text-xs text-red-500">Error</div>}
    </div>
  );
};

export const RawView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
}> = ({ doc, changeDoc }) => {
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

  if (!doc) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-1/2 border-r border-gray-300 min-h-full overflow-y-scroll">
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
      <div className="w-1/2 min-h-full overflow-y-scroll">
        <div className=" px-2 py-1  bg-gray-100  text-sm">Actions</div>
        <div className="p-4">
          {Object.entries(MarkdownDocActions).map(([action, config]) => (
            <ActionForm action={action} config={config} changeDoc={changeDoc} />
          ))}
        </div>
        <div>
          <div className=" px-2 py-1 bg-gray-100 text-sm">LLM Tools</div>
          <div className="p-4">
            {(doc.llmTools ?? DEFAULT_LLM_TOOLS).map((tool) => (
              <LLMToolView doc={doc} tool={tool} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
