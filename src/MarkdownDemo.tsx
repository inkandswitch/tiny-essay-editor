/** @jsx jsx */
/* @jsxFrag React.Fragment */

import { css } from "@emotion/react";
import { MarkdownDoc } from "./slate-automerge";
import ReactJson from "react-json-view";
import MarkdownEditor from "./MarkdownEditor";
import { useDocument } from "@automerge/automerge-repo-react-hooks";

export default function MarkdownDemo() {
  const [doc, changeDoc] = useDocument<MarkdownDoc>();

  return (
    <div
      css={css`
        display: grid;
        grid-template-columns: 50% 50%;
        grid-template-rows: auto;
        grid-template-areas: "app-left app-right";
        column-gap: 50px;

        width: 90vw;
        height: 100%;
        box-sizing: border-box;
      `}
    >
      <div
        css={css`
          grid-area: app-left;
          overflow: hidden;
        `}
      >
        <div
          css={css`
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            color: #aaa;
          `}
        >
          Editor UI
        </div>
        <MarkdownEditor doc={doc} changeDoc={changeDoc} />
      </div>
      <div
        css={css`
          grid-area: app-right;
          overflow: hidden;
        `}
      >
        <div
          css={css`
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            color: #aaa;
          `}
        >
          Automerge doc state
        </div>
        <ReactJson
          src={{
            content: doc.content.toString(),
          }}
          collapsed={false}
          collapseStringsAfterLength={280}
          displayDataTypes={false}
          displayObjectSize={false}
        />
      </div>
    </div>
  );
}
