import { DatatypeId } from "@/os/datatypes";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";

export type DocLink = {
  name: string;
  type: DatatypeId;
  url: AutomergeUrl;
  branchUrl?: AutomergeUrl;
  branchName?: string;
};

export type DocLinkWithFolderPath = DocLink & {
  /** A list of URLs to folder docs that make up the path to this link.
   *  Always contains at least one URL: the root folder for the user
   */
  folderPath: AutomergeUrl[];
};

export type FolderDoc = {
  title: string;
  docs: DocLink[];
} & HasPatchworkMetadata<never, never>;

// A type representing a folder where the contents are either links to regular docs,
// or links to folders, in which case we have access to the contents of the folder
export type FolderDocWithChildren = Omit<FolderDoc, "docs"> & {
  docs: (DocLink & {
    folderContents?: FolderDocWithChildren;
  })[];
};
