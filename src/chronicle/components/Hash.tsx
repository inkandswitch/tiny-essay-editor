import React, { useMemo } from "react";
import { CopyIcon } from "lucide-react";
import { hashToColor } from "../utils";

export const Hash: React.FC<{ hash: string }> = ({ hash }) => {
  const color = useMemo(() => hashToColor(hash), [hash]);

  return (
    <div className="inline-flex items-center border border-gray-300 rounded-full pl-1">
      <div
        className="w-2 h-2 rounded-full mr-[2px]"
        style={{ backgroundColor: color }}
      ></div>
      <div>{hash.substring(0, 6)}</div>
      <div
        className="cursor-pointer px-1 ml-1 hover:bg-gray-50 active:bg-gray-200 rounded-full"
        onClick={() => {
          navigator.clipboard.writeText(hash);
        }}
      >
        <CopyIcon size={10} />
      </div>
    </div>
  );
};
