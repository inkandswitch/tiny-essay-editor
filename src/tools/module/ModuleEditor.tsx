import { useDocument } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";
import React from "react";

import { ModuleDoc } from "@/datatypes/module";
import { EditorProps } from "@/os/tools";
import { Input } from "@/components/ui/input";

export const ModuleEditor: React.FC<EditorProps<never, never>> = ({
  docUrl,
  docHeads,
}: EditorProps<never, never>) => {
  const [moduleDoc, changeModuleDoc] = useDocument<ModuleDoc>(docUrl);

  const moduleAtHeads = docHeads ? A.view(moduleDoc, docHeads) : moduleDoc;

  if (!moduleDoc) {
    return null;
  }

  const onChangeUrlInput = (evt) => {
    changeModuleDoc((doc) => {
      doc.url = evt.target.value;
    });
  };

  return (
    <div className="p-4 w-full">
      <div className="font-mono mb-6">
        <div className="mb-2 text-gray-600 uppercase font-mono">URL</div>
        <Input value={moduleDoc.url ?? ""} onChange={onChangeUrlInput} />
      </div>
    </div>
  );
};
