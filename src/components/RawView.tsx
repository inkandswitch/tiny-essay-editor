import { ChangeFn } from "@automerge/automerge/next";
import { LLMTool, MarkdownDoc } from "../schema";
import ReactJson from "@microlink/react-json-view";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";

import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { mapValues } from "lodash";
import { MarkdownDocActions } from "@/MarkdownDoc";
import { inferDocumentEdits } from "../llm";
import { DEFAULT_LLM_TOOLS } from "../prompts";
import { ActionSpec } from "../types";
import { Edit, Wrench, FileJson, Trash } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "./ui/textarea";

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
        variant="outline"
        onClick={() => {
          config.executeFn(changeDoc, params);
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

const LLMToolView: React.FC<{
  doc: MarkdownDoc;
  changeDoc: (fn: ChangeFn<MarkdownDoc>) => void;
  tool: LLMTool;
}> = ({ doc, changeDoc, tool }) => {
  const [uiState, setUiState] = useState<"idle" | "loading" | "error">("idle");

  const runLLM = async (prompt: string) => {
    setUiState("loading");
    const result = await inferDocumentEdits(prompt, doc);
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
      action.executeFn(changeDoc, edit.parameters);
    }
  };
  return (
    <div className="my-2 p-4 border bg-gray-100 border-gray-200 rounded-sm">
      <div className="flex">
        <Button
          variant="outline"
          disabled={uiState === "loading"}
          onClick={() => runLLM(tool.prompt)}
        >
          {tool.name}
        </Button>
        <div style={{ marginLeft: "auto" }}>
          <Dialog>
            <DialogTrigger>
              <Button className="text-xs text-gray-500" variant="ghost">
                <Edit size="1rem" className="inline mr-1" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="md:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>
                  <Edit className="inline mr-1" size="1rem" /> Edit tool
                </DialogTitle>
                <DialogDescription>
                  Program an AI to give tailored feedback on your writing.
                </DialogDescription>
                <DialogTrigger asChild>Close</DialogTrigger>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name:
                  </Label>
                  <Input
                    placeholder="My new tool"
                    className="col-span-3"
                    value={tool.name}
                    // TODO: only update the doc on save, not on every keystroke?
                    onChange={(e) => {
                      changeDoc((d) => {
                        const existingTool = d.llmTools.find(
                          (t) => t.name === tool.name
                        );
                        if (existingTool) {
                          existingTool.name = e.target.value;
                        }
                      });
                    }}
                  ></Input>
                </div>
              </div>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Prompt:
                  </Label>
                  <Textarea
                    rows={15}
                    placeholder="Your prompt here"
                    className="col-span-3"
                    value={tool.prompt}
                    // TODO: only update the doc on save, not on every keystroke?
                    onChange={(e) => {
                      changeDoc((d) => {
                        const existingTool = d.llmTools.find(
                          (t) => t.name === tool.name
                        );
                        if (existingTool) {
                          existingTool.prompt = e.target.value;
                        }
                      });
                    }}
                  ></Textarea>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            className="text-xs text-gray-500"
            variant="ghost"
            onClick={() => console.log("not implemented yet")}
          >
            <Trash size="1rem" className="inline mr-1" />
            Delete
          </Button>
        </div>
      </div>

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

  const addTool = () => {
    changeDoc((d) => {
      // UGHHH WE NEED CAMBRIA
      if (d.llmTools === undefined) {
        d.llmTools = [];
      }

      d.llmTools.push({
        name: "New Tool",
        prompt: "Write what kind of feedback you want from the AI",
      });
    });
  };

  if (!doc) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-1/2 border-r border-gray-300 min-h-full overflow-y-scroll">
        <div className=" px-2 py-1 bg-gray-100 text-sm">
          <FileJson className="inline" size="1rem" />
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
      <div className="w-1/2 min-h-full overflow-y-scroll">
        <div className=" px-2 py-1  bg-gray-100  text-sm">
          <Edit className="inline" size="1rem" /> Actions
        </div>
        <div className="p-4">
          {Object.entries(MarkdownDocActions).map(([action, config]) => (
            <ActionForm action={action} config={config} changeDoc={changeDoc} />
          ))}
        </div>
        <div>
          <div className=" px-2 py-1 bg-gray-100 text-sm">
            <Wrench className="inline" size="1rem" /> Tools
          </div>
          <div className="p-4">
            {(doc.llmTools ?? DEFAULT_LLM_TOOLS).map((tool) => (
              <LLMToolView doc={doc} changeDoc={changeDoc} tool={tool} />
            ))}
            <Button
              className="font-semibold text-gray-500 text-xs"
              variant="ghost"
              onClick={addTool}
            >
              + Add a tool
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
