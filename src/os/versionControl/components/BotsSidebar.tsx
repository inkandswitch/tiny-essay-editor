import { BotIcon } from "lucide-react";
import React from "react";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Doc, DocHandle } from "@automerge/automerge-repo";
import { DataType } from "@/os/datatypes";
import { makeBotTextEdits } from "../bots";
import { MarkdownDoc } from "@/packages/essay";
import { toast } from "sonner";

const SUPPORTED_DATATYPES = ["essay"];

export const BotsSidebar = ({
  doc,
  handle,
  dataType,
}: {
  doc: Doc<unknown>;
  handle: DocHandle<unknown>;
  dataType: DataType<unknown, unknown, unknown>;
}) => {
  const [editPrompt, setEditPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    setLoading(true);
    try {
      await makeBotTextEdits({
        targetDocHandle: handle as DocHandle<MarkdownDoc>,
        prompt: editPrompt,
        path: ["content"],
      });
    } catch (e) {
      toast.error("Error performing edit");
    }
    setLoading(false);
    toast.success("Edit performed");
  };

  if (!SUPPORTED_DATATYPES.includes(dataType.id)) {
    return (
      <div className="p-2 text-sm text-gray-500 flex items-center justify-center h-full">
        Bots are not yet supported for datatype: {dataType.id}
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-sm font-medium text-gray-500">
        <div className="flex items-center gap-2">
          <BotIcon size={16} />
          Bot Editor
        </div>
      </h3>
      <textarea
        className="mt-2 p-2 border border-gray-300 rounded w-full"
        value={editPrompt}
        onChange={(e) => setEditPrompt(e.target.value)}
        placeholder="Make it do X..."
      />
      <div className="mt-2 flex gap-2">
        <Button onClick={handleEdit}>Make Edit</Button>
      </div>
      {loading && <div className="mt-2 text-sm text-gray-500">Loading...</div>}
    </div>
  );
};
