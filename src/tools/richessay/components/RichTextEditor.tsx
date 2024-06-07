import React, {useEffect, useState, useRef} from "react"
import { AutoMirror, basicSchemaAdapter } from "@automerge/prosemirror"
import { EditorView } from "prosemirror-view"
import { MarkType, Schema } from "prosemirror-model"
import { baseKeymap, toggleMark, setBlockType, chainCommands, wrapIn} from "prosemirror-commands"
import { keymap } from "prosemirror-keymap"
import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo"
import { type TeeDoc } from "../schema"
import {Command, EditorState, Transaction} from "prosemirror-state"
import { splitListItem, liftListItem, sinkListItem, wrapInList } from "prosemirror-schema-list"
import { Braces, Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Indent, Outdent, TextQuote, Image} from "lucide-react";
import "prosemirror-view/style/prosemirror.css"
//import "../../tee/index.css";
import "../index.css";
import Modal from "./Modal"
import LinkForm from "./LinkForm"
import ImageForm from "./ImageForm"

export type EditorProps = {
  handle: DocHandle<TeeDoc>;
  path: string[];
}

export const RichTextEditor = ({ handle, path }: EditorProps) => {
  const editorRoot = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<EditorView | null>(null)
  const [editorCrashed, setEditorCrashed] = useState<boolean>(false);
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)

  const handleReady = handle.isReady();

  useEffect(() => {
    if (!handleReady) {
      return
    }
    const autoMirror = new AutoMirror(path, basicSchemaAdapter)
    const initialDoc = autoMirror.initialize(handle)
    const editorConfig = {
      schema: autoMirror.schema,
      history,
      plugins: [
        keymap({
          "Mod-b": toggleBold(autoMirror.schema),
          "Mod-i": toggleItalic(autoMirror.schema),
          "Mod-l": toggleMark(autoMirror.schema.marks.link, {
            href: "https://example.com",
            title: "example",
          }),
          "Enter": splitListItem(autoMirror.schema.nodes.list_item),
        }),
        keymap({...baseKeymap}),
      ],
      doc: initialDoc,
    }

    const state = EditorState.create(editorConfig)
    const view = new EditorView(editorRoot.current, {
      state,
      dispatchTransaction: (tx: Transaction) => {
        try {
          const newState = autoMirror.intercept(handle, tx, view.state)
          view.updateState(newState)
        } catch (e) {
          console.error(
            "Encountered an error in dispatch function; crashing the editor to notify the user and avoid data loss."
          );
          console.error(e);
          setEditorCrashed(true)
          view.destroy()
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onPatch: (args: DocHandleChangePayload<unknown>) => void = (
      {doc, patches, patchInfo}
    ) => {
      console.log(`patch received`)
      const newState = autoMirror.reconcilePatch( patchInfo.before, doc, patches, view.state)
      view.updateState(newState)
    }
    handle.on("change", onPatch)

    setView(view)

    return () => {
      handle.off("change", onPatch)
      view.destroy()
    }
  }, [handle, handleReady])

  const onBoldClicked = () => {
    if (view) {
      toggleBold(view.state.schema)(view.state, view.dispatch, view)
    }
  }

  const onItalicClicked = () => {
    if (view) {
      toggleItalic(view.state.schema)(view.state, view.dispatch, view)
    }
  }

  const onIncreaseIndent = () => {
    if (view) {
      // If we're in a list, figure out what kind it is
      const { $from } = view.state.selection
      let listNode = null
      for (let i = $from.depth; i > 0; i--) {
        if ($from.node(i).type.name === "list_item") {
          listNode = $from.node(i - 1)
          break
        }
      }
      const listType = listNode ? listNode.type : view.state.schema.nodes.bullet_list
      if (listNode) {
        chainCommands(
          sinkListItem(view.state.schema.nodes.list_item),
          wrapInList(listType),
        )(view.state, view.dispatch, view)
      }
    }
  }

  const onDecreaseIndent = () => {
    if (view) {
      liftListItem(view.state.schema.nodes.list_item)(view.state, view.dispatch, view)
    }
  }

  const onBlockQuoteClicked = () => {
    if (view) {
      turnSelectionIntoBlockquote(view.state, view.dispatch, view)
    }
  }

  const onToggleOrderedList = () => {
    if (view) {
      wrapInList(view.state.schema.nodes.bullet_list)(
        view.state,
        view.dispatch,
        view,
      )
    }
  }

  const onToggleNumberedList = () => {
    if (view) {
      wrapInList(view.state.schema.nodes.ordered_list)(
        view.state,
        view.dispatch,
        view,
      )
    }
  }

  const onHeadingClicked = (level: number) => {
    if (view) {
      const { $from } = view.state.selection
      if (
        $from.node().type.name === "heading" &&
        $from.node().attrs.level === level
      ) {
        setBlockType(view.state.schema.nodes.paragraph)(
          view.state,
          view.dispatch,
          view,
        )
      } else {
        setBlockType(view.state.schema.nodes.heading, { level })(
          view.state,
          view.dispatch,
          view,
        )
      }
    }
  }

  const showImageDialog = () => {
    setImageModalOpen(true)
  }

  const onImageChosen = (url: string) => {
    if (view) {
      const { from, to } = view.state.selection
      const tr = view.state.tr
      tr.replaceRangeWith(
        from,
        to,
        view.state.schema.nodes.image.create({ src: url, title: "", alt: "" }),
      )
      view.dispatch(tr)
    }
  }

  const showLinkDialog = () => {
    setLinkModalOpen(true)
  }

  const onLinkChosen = (url: string) => {
    if (view) {
      const { from, to } = view.state.selection
      const tr = view.state.tr
      tr.addMark(from, to, view.state.schema.marks.link.create({ href: url, title: "" }))
      view.dispatch(tr)
    }
  }

  const onCodeClicked = () => {
    if (view) {
      setBlockType(view.state.schema.nodes.code_block)(view.state, view.dispatch, view)
    }
  }


  if (editorCrashed) {
    return (
      <div className="bg-red-100 p-4 rounded-md">
        <p className="mb-2">⛔️ Error: editor crashed!</p>
        {import.meta.env.MODE === "development" && (
          <p className="mb-2">Probably due to hot reload in dev.</p>
        )}
        <p className="mb-2">
          We're sorry for the inconvenience. Please reload to keep working. Your
          data was most likely saved before the crash.
        </p>
        <p className="mb-2">
          If you'd like you can screenshot the dev console as a bug report.
        </p>
      </div>
    );
  }

  return <div id="prosemirror">
    <MenuBar
      onBoldClicked={onBoldClicked}
      onItalicClicked={onItalicClicked}
      onLinkClicked={showLinkDialog}
      onBlockQuoteClicked={onBlockQuoteClicked}
      onToggleOrderedList={onToggleOrderedList}
      onToggleNumberedList={onToggleNumberedList}
      onIncreaseIndent={onIncreaseIndent}
      onDecreaseIndent={onDecreaseIndent}
      onHeadingClicked={onHeadingClicked}
      onImageClicked={showImageDialog}
      onCodeClicked={onCodeClicked}
    />
    <div className="@container flex bg-gray-50 justify-center codemirror-editor cm-content">
      {/* This has some subtle behavior for responsiveness.
          - We use container queries to adjust the width of the editor based on the size of our container.
          - We get the right line width by hardcoding a max-width and x-padding
          - We take over the full screen on narrow displays (showing comments on mobile is TODO)
       */}
      <div className="bg-white border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4 ">
        <div id="editor" ref={editorRoot} />
      </div>
    </div>
    <Modal
      isOpen={imageModalOpen}
      onClose={() => {
        setImageModalOpen(false)
      }}
    >
      <ImageForm
        onImageChosen={url => {
          setImageModalOpen(false)
          onImageChosen(url)
        }}
      />
    </Modal>
    <Modal
      isOpen={linkModalOpen}
      onClose={() => {
        setLinkModalOpen(false)
      }}
    >
      <LinkForm
        onUrlChosen={url => {
          setLinkModalOpen(false)
          onLinkChosen(url)
        }}
      />
    </Modal>
  </div>
}


const toggleBold = (schema: Schema) => toggleMarkCommand(schema.marks.strong)
const toggleItalic = (schema: Schema) => toggleMarkCommand(schema.marks.em)

function toggleMarkCommand(mark: MarkType): Command {
  return (
    state: EditorState,
    dispatch: ((tr: Transaction) => void) | undefined
  ) => {
    return toggleMark(mark)(state, dispatch)
  }
}

type MenuBarProps = {
  onBoldClicked: () => void
  onItalicClicked: () => void
  onLinkClicked: () => void
  onBlockQuoteClicked: () => void
  onToggleOrderedList: () => void
  onToggleNumberedList: () => void
  onIncreaseIndent: () => void
  onDecreaseIndent: () => void
  onHeadingClicked: (level: number) => void
  onImageClicked: () => void
  onCodeClicked: () => void
}

function MenuBar({
  onBoldClicked,
  onItalicClicked,
  onLinkClicked,
  onBlockQuoteClicked,
  onToggleOrderedList,
  onToggleNumberedList,
  onIncreaseIndent,
  onDecreaseIndent,
  onHeadingClicked,
  onImageClicked,
  onCodeClicked,
}: MenuBarProps) {
  return (
    <div id="menubar" className="menubar">
      <div className="row">
        <button id="bold" onClick={onBoldClicked}>
          <Bold />
        </button>
        <button id="italic" onClick={onItalicClicked}>
          <Italic />
        </button>
        <button id="link" onClick={onLinkClicked}>
          <Link />
        </button>
        <button onClick={onCodeClicked}>
          <Braces />
        </button>
        <button onClick={() => onHeadingClicked(1)}>
          <Heading1 />
        </button>
        <button onClick={() => onHeadingClicked(2)}>
          <Heading2 />
        </button>
        <button onClick={() => onHeadingClicked(3)}>
          <Heading3 />
        </button>
        <button onClick={() => onHeadingClicked(4)}>
          <Heading4 />
        </button>
        <button onClick={() => onHeadingClicked(5)}>
          <Heading5 />
        </button>
        <button onClick={() => onHeadingClicked(6)}>
          <Heading6 />
        </button>
      </div>
      <div className="row">
        <CaptionedButton caption="Blockquote" onClick={onBlockQuoteClicked}>
          <TextQuote />
        </CaptionedButton>
        <CaptionedButton caption="number list" onClick={onToggleNumberedList}>
          <ListOrdered />
        </CaptionedButton>
        <CaptionedButton caption="bullet list" onClick={onToggleOrderedList}>
          <List />
        </CaptionedButton>
        <CaptionedButton caption="indent" onClick={onIncreaseIndent}>
          <Indent />
        </CaptionedButton>
        <CaptionedButton caption="outdent" onClick={onDecreaseIndent}>
          <Outdent />
        </CaptionedButton>
        <CaptionedButton caption="image" onClick={onImageClicked}>
          <Image />
        </CaptionedButton>
      </div>
    </div>
  )
}

function CaptionedButton({
  caption,
  onClick,
  children,
}: {
  caption: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div className="captionedButton">
      <button onClick={onClick}>{children}</button>
      <p>{caption}</p>
    </div>
  )
}

function turnSelectionIntoBlockquote(
  state: EditorState,
  dispatch: (tr: Transaction) => void | undefined,
  view: EditorView,
): boolean {
  // Check if the blockquote can be applied
  const { $from, $to } = state.selection
  const range = $from.blockRange($to)

  if (!range) {
    return false
  }

  // Check if we can wrap the selection in a blockquote
  if (!wrapIn(state.schema.nodes.blockquote)(state, undefined, view)) {
    return false
  }

  // Apply the blockquote transformation
  if (dispatch) {
    wrapIn(state.schema.nodes.blockquote)(state, dispatch, view)
  }
  return true
}
