import { HasVersionControlMetadata } from "@/os/versionControl/schema";

export type DataGridDoc = HasVersionControlMetadata<never, never> & {
  title: string; // The title of the table

  // NOTE: modeling the data this way does not result in reasonable merges.
  // The correct technique is like this, but we need cursors for
  // arbitrary lists to do that in Automerge:
  // https://mattweidner.com/2022/02/10/collaborative-data-design.html#case-study-a-collaborative-spreadsheet
  data: any[][]; // The data for the table
};
// These are bad unstable anchors but we don't have
// anything better until we model the spreadsheet data in a better way (see above)

export type DataGridDocAnchor = {
  row: number;
  column: number;
};
