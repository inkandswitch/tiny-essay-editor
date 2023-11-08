# tiny essay editor

This is a simple collaborative Markdown editor built in React, with inline format preview and inline commenting.

It's built on [automerge](https://github.com/automerge/automerge) and [automerge-repo](https://github.com/automerge/automerge-repo) for CRDT-based storage and sync. It uses [Codemirror](https://codemirror.net/) for markdown editing UI, and  [automerge-codemirror](https://github.com/automerge/automerge-codemirror) to connect to Codemirror.

<img width="1318" alt="CleanShot 2023-11-08 at 14 15 49@2x" src="https://github.com/inkandswitch/tiny-essay-editor/assets/934016/672e0642-0ecd-47f6-8595-be2629a4e265">

## Status

This app is primarily intended for internal use at Ink & Switch for editing essays, so there are some features that are specialized towards that use case. We don't plan to develop it into a general-purpose editor that anyone can use for anything. But of course, it can edit any Markdown document too. If you want to actually use this editor in earnest, you might want to fork it to build your own ideas.

Hopefully the code serves as a useful sample for building apps based on automerge-repo, automerge-codemirror, and React.

## Usage

- Go to the root of this domain in your browser to make a new doc, or hit the New button.
- The URL will update with a doc ID. If you share that URL to another browser/device, it should sync live.

## Feature set

- Edit Markdown with inline format preview
- Write inline comments + replies
- Live sync through Automerge
- Save out .md file with a Download button
- Typeset similarly to Ink & Switch essays

## Run it

`yarn`

`yarn dev`
