import { useMemo } from "react";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { save, open } from "@tauri-apps/api/dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { isNull } from "lodash";

export interface FileDoc {
  type: string;
  data: ArrayBuffer;
}

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

export const saveFile = async (blob: Blob, suggestedName: string, types) => {
  const path = await save({
    defaultPath: suggestedName,
    filters: [{
      name: 'Markdown',
      extensions: ['md']
    }]
  });
  const blobText = await blob.text();
  await writeTextFile(path, blobText);
  return;
};

export const openFiles = async () => {
  const selected = await open({
    multiple: true,
    directory: false,
  });
  if (Array.isArray(selected)) {
    const contents = selected.map(async (path) => {
      const contents = await readTextFile(path);
      return contents
    });
    return await Promise.all(contents);
  } else if (selected === null) {
    return null;
  } else {
    const contents = await readTextFile(selected);
    return [contents];
  }
};