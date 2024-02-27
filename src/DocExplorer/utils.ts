import { useMemo } from "react";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import queryString from "query-string";
import { UrlHashParams } from "./components/DocExplorer";

export interface FileDoc {
  type: string;
  data: ArrayBuffer;
}

// Update the URL hash to reflect a given doc
export const setUrlHashForDoc = (params: UrlHashParams) => {
  if (!params) {
    window.location.hash = "";
    return;
  }

  const { docUrl, docType, branch } = params;

  const newHash = queryString.stringify({
    docUrl,
    docType,
    branchUrl: branch?.type === "branch" ? branch.url : undefined,
  });
  window.location.hash = newHash;
};

export const useBlobUrl = (url: AutomergeUrl) => {
  const [file] = useDocument<FileDoc>(url);

  return useMemo(() => {
    if (!file || !file.data || !file.type) {
      return;
    }

    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    return url;
  }, [file?.data, file?.type]);
};
export const uploadFile = async (
  repo: Repo,
  file: File
): Promise<AutomergeUrl> => {
  const reader = new FileReader();
  const fileDocHandle = repo.create<FileDoc>();

  const isLoaded = new Promise((resolve) => {
    reader.onload = (event) => {
      fileDocHandle.change((fileDoc) => {
        fileDoc.type = file.type;
        fileDoc.data = new Uint8Array(event.target.result as ArrayBuffer);
      });

      resolve(true);
    };
  });

  reader.readAsArrayBuffer(file);

  await isLoaded;
  return fileDocHandle.url;
};

// taken from https://www.builder.io/blog/relative-time
/**
 * Convert a date to a relative time string, such as
 * "a minute ago", "in 2 hours", "yesterday", "3 months ago", etc.
 * using Intl.RelativeTimeFormat
 */
export function getRelativeTimeString(
  date: Date | number,
  lang = navigator.language
): string {
  // Allow dates or times to be passed
  const timeMs = typeof date === "number" ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Array reprsenting one minute, hour, day, week, month, etc in seconds
  const cutoffs = [
    60,
    3600,
    86400,
    86400 * 7,
    86400 * 30,
    86400 * 365,
    Infinity,
  ];

  // Array equivalent to the above but in the string representation of the units
  const units: Intl.RelativeTimeFormatUnit[] = [
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "month",
    "year",
  ];

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex(
    (cutoff) => cutoff > Math.abs(deltaSeconds)
  );

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}

export function arraysAreEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
} // taken from https://web.dev/patterns/files/save-a-file

export const saveFile = async (blob, suggestedName, types) => {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    "showSaveFilePicker" in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    try {
      // Show the file save dialog.
      // @ts-expect-error showSaveFilePicker is not in the TS types
      const handle = await showSaveFilePicker({
        suggestedName,
        types,
      });
      // Write the blob to the file.
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name === "AbortError") {
        return;
      }
    }
  }
  // Fallback if the File System Access API is not supported…
  // Create the blob URL.
  const blobURL = URL.createObjectURL(blob);
  // Create the `<a download>` element and append it invisibly.
  const a = document.createElement("a");
  a.href = blobURL;
  a.download = suggestedName;
  a.style.display = "none";
  document.body.append(a);
  // Programmatically click the element.
  a.click();
  // Revoke the blob URL and remove the element.
  setTimeout(() => {
    URL.revokeObjectURL(blobURL);
    a.remove();
  }, 1000);
};
