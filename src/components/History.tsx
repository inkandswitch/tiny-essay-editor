import { MarkdownDoc } from "../schema";
import { DocHandle } from "@automerge/automerge-repo";
import { Heads, decodeChange, getAllChanges } from "@automerge/automerge/next";

export const History: React.FC<{
  handle: DocHandle<MarkdownDoc>;
  diffHeads: Heads;
  setDiffHeads: (heads: Heads) => void;
}> = ({ handle, diffHeads, setDiffHeads }) => {
  const changes = getAllChanges(handle.docSync());

  return (
    <div>
      <div className="p-4 text-gray-500 uppercase font-medium text-sm">
        Version Control
      </div>
      <div className="p-2 border-t border-b border-gray-300">
        <div className="text-xs">Diff against older draft</div>
        <input
          type="range"
          min="0"
          max={changes.length - 1}
          onChange={(e) => {
            const change = changes[e.target.value];
            setDiffHeads([decodeChange(change).hash]);
          }}
          value={changes.findIndex(
            (change) => decodeChange(change).hash === diffHeads[0]
          )}
        />
      </div>
      <div className="p-2 border-b border-gray-300">
        <div className="text-xs">Changelog</div>
        {changes.reverse().map((change, i) => {
          const decoded = decodeChange(change);
          const active = decoded.hash === diffHeads[0];
          return (
            <div
              className={`text-xs cursor-default mb-1 ${
                active ? "font-bold" : ""
              }`}
              onMouseEnter={() => setDiffHeads([decoded.hash])}
            >
              {decoded.hash}
            </div>
          );
        })}
      </div>
    </div>
  );
};
