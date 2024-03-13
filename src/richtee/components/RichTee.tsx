import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";

import { RichTeeDoc } from "../schema";
import { RichTeeDatatype } from "../datatype";
import { Editor } from "./Editor";

import { useMemo } from "react";

export const RichTee = ({
  docUrl,
  docHeads,
  readOnly,
}: {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  readOnly?: boolean;
}) => {
  const [latestDoc, changeDoc] = useDocument<RichTeeDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<RichTeeDoc>(docUrl);

  const doc = useMemo(
    () => (docHeads ? A.view(latestDoc, docHeads) : latestDoc),
    [latestDoc, docHeads]
  );

  return (
    <div className="h-full overflow-auto">
      <Editor name="left" handle={handle} path={["text"]} />
    </div>
  );
};
