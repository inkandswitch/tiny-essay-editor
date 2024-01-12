import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const ESSAY_STYLES = {
  "&": {},
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  "&.cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    height: "100%",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-content": {
    height: "100%",
    fontFamily: '"Merriweather", serif',
    padding: "10px 0",
    margin: "0 var(--cm-padding-x)",
    // textAlign: "justify",
    textWrap: "pretty",
    lineHeight: "24px",
  },
  ".cm-content li": {
    marginBottom: 0,
  },
  ".cm-activeLine": {
    backgroundColor: "inherit",
  },
  ".cm-comment-thread": {
    backgroundColor: "rgb(255 249 194)",
  },
  ".cm-comment-thread.active": {
    backgroundColor: "rgb(255 227 135)",
  },
  // active highlighting wins if it's inside another thread
  ".cm-comment-thread.active .cm-comment-thread": {
    backgroundColor: "rgb(255 227 135)",
  },
  ".frontmatter": {
    fontFamily: "monospace",
    color: "#666",
    textDecoration: "none",
    fontWeight: "normal",
    lineHeight: "0.8em",
  },
  ".cm-patch-splice": {
    backgroundColor: "rgb(0 255 0 / 15%)",
    borderBottom: "rgb(0 202 0 / 50%) 2px solid",
    borderRadius: "3px",
  },
  ".cm-patch-pencil": {
    borderBottom: "rgb(0 0 0 / 10%) 2px solid",
    color: "rgb(0 0 0 / 60%)",
    fontFamily: "'Schoolbell', cursive",
    fontSize: "1.1em",
  },
};

export const essayTheme = EditorView.theme(ESSAY_STYLES);

const baseHeadingStyles = {
  fontFamily: '"Merriweather Sans", sans-serif',
  fontWeight: 400,
  textDecoration: "none",
};

const baseCodeStyles = {
  fontFamily: "monospace",
  fontSize: "14px",
};

export const markdownStyles = HighlightStyle.define([
  {
    tag: tags.heading1,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading2,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading3,
    ...baseHeadingStyles,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading4,
    ...baseHeadingStyles,
    fontSize: "1.1rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.comment,
    color: "#555",
    fontFamily: "monospace",
  },
  {
    tag: tags.strong,
    fontWeight: "bold",
  },
  {
    tag: tags.emphasis,
    fontStyle: "italic",
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
  },
  {
    tag: [tags.meta],
    fontWeight: 300,
    color: "#888",
    fontFamily: '"Merriweather Sans", sans-serif',
  },
  { tag: tags.keyword, ...baseCodeStyles, color: "#708" },
  {
    tag: [
      tags.atom,
      tags.bool,
      tags.url,
      tags.contentSeparator,
      tags.labelName,
    ],
    ...baseCodeStyles,
    color: "#219",
  },
  { tag: [tags.literal, tags.inserted], ...baseCodeStyles, color: "#164" },
  { tag: [tags.string, tags.deleted], ...baseCodeStyles, color: "#5f67b5" },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    ...baseCodeStyles,
    color: "#e40",
  },
  { tag: tags.definition(tags.variableName), ...baseCodeStyles, color: "#00f" },
  { tag: tags.local(tags.variableName), ...baseCodeStyles, color: "#30a" },
  { tag: [tags.typeName, tags.namespace], ...baseCodeStyles, color: "#085" },
  { tag: tags.className, ...baseCodeStyles, color: "#167" },
  {
    tag: [tags.special(tags.variableName), tags.macroName],
    ...baseCodeStyles,
    color: "#256",
  },
  { tag: tags.definition(tags.propertyName), ...baseCodeStyles, color: "#00c" },
]);
