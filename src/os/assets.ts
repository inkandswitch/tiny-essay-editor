import { AutomergeUrl } from "@automerge/automerge-repo";

export type FileEntry = {
  contentType: string;
  contents: string | Uint8Array;
};

export type HasAssets = {
  assetsDocUrl: AutomergeUrl;
};

export type AssetsDoc = {
  files: { [filename: string]: FileEntry };
};
