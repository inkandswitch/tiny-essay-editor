import { BotIcon } from "lucide-react";
import React from "react";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export const BotsSidebar = () => {
  const [editPrompt, setEditPrompt] = useState("");

  const handleEdit = () => {
    // Perform the edit action here
    console.log("Edit performed with prompt:", editPrompt);
  };

  const handleProposeEdit = () => {
    // Perform the propose edit action here
    console.log("Propose edit on branch with prompt:", editPrompt);
  };

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
        <Button onClick={handleProposeEdit}>Try on branch</Button>
      </div>
    </div>
  );
};
