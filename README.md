# Patchwork

Patchwork is a general framework for editing automerge documents with arbitrary tools.

## Concepts

- Datatypes: schemas for automerge documents. eg: markdown, drawing
- Tools: UIs for viewing and editing documents. eg: markdown editor, tldraw canvas, raw json editor

## Development

### Run it

```
yarn
yarn dev
```

### Folder structure

This repo has many independent parts which are collected in a single repo for convenience, but which we intend to separate more in the future. As such, we need to carefully observe structural boundaries.

Notably, datatypes and tools are separated because we want to encourage multiple tools for the same datatype, and discourage tight coupling.

- os
  - contains universal functionality for the OS layer, including OS chrome (like the Explorer sidebar) and versioning utilities

- datatypes
   - contains a folder for each datatype.
   - A datatype should always define an `index.ts` that explicitly defines what functionality is intended to be used outside of the datatype.
   - The `index.ts` file should export the datatype definition as a default export

- tools
  - contains a folder for each tool
  - a tool should always define an `index.ts` file that only exports the tool definition as a default export
  - tools shouldn't export code to be used outside of the tool folder
      - There is a question how to handle variations like how to model

- Dependencies
  - os: doesn't depend on other files (except for pulling together the tools and datatypes). Anything can import definitions from the os folder.
  - datatypes: depends on functionality in os. Tools can import functions from datatyes
  - tools: depends on functionality both from os and datatyes. Avoid referencing definitions in tools from outside or other tools. If you need to share functionality try to move it up into the datatype or the os

### Adding a new datatype

- You can copy an existing datatype as a template. `markdown` is a reasonable example
- Create a new datatype
  - Create a new folder in `src/datatypes/` for your datatype
  - Fill in `src/datatypes/<your_datatype>/datatype.ts` with a TS type, an init function, and other functions
  - Add your new datatype to the `DATA_TYPES` map in `src/os/datatypes.ts`
- Create a tool that can view / edit your new data type
  - Create a new folder in `src/tools/`
  - Add your new tool to the `TOOLS` list in `src/os/tools.ts`
    p

