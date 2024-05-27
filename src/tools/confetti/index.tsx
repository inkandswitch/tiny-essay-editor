import React from "react";

import { EditorProps } from "@/os/tools";

const ConfettiViewer: React.FC<EditorProps<never, never>> = ({}: EditorProps<
  never,
  never
>) => {
  return (
    <div>
      <button>confetti</button>
    </div>
  );
};

export default ConfettiViewer;
