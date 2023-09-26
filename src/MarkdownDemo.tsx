/** @jsx jsx */
/* @jsxFrag React.Fragment */

import { jsx, css } from '@emotion/react'
import { useAutomergeDoc } from "./hooks"
import { MarkdownDoc, RichTextDoc } from "./slate-automerge"
import Automerge from 'automerge'
import ReactJson from 'react-json-view'
import RichTextEditor from './RichTextEditor'
import MarkdownEditor from './MarkdownEditor'

export default function MarkdownDemo() {
  const [doc, changeDoc] = useAutomergeDoc<MarkdownDoc>({
    content: new Automerge.Text(`# Markdown with comments

This is a Markdown doc with _rich formatting_ and **formatting preview**.

Try adding a comment to the doc! It will stay attached as the doc changes.`),
    comments: []
  })

  return <div css={css`
    display: grid;
    grid-template-columns: 50% 50%;
    grid-template-rows: auto;
    grid-template-areas:
      "app-left app-right";
    column-gap: 50px;

    width: 90vw;
    height: 100%;
    box-sizing: border-box;
  `}>
    <div css={css`grid-area: app-left; overflow: hidden;`}>
      <div css={css`margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #aaa;`}>Editor UI</div>
      <MarkdownEditor doc={doc} changeDoc={changeDoc} />
    </div>
    <div css={css`grid-area: app-right; overflow: hidden;`}>
    <div css={css`margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #aaa;`}>Automerge doc state</div>
      <ReactJson src={{
        content: doc.content.toString(),
        comments: doc.comments.map(span => ({
          start: span.range.start.index,
          end: span.range.end.index,
          text: span.text
        }))
      }} collapsed={false} collapseStringsAfterLength={280} displayDataTypes={false} displayObjectSize={false} />
    </div>
  </div>
}