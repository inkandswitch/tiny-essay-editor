import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import * as R from "remeda";

// TODO: kept in sync manually between multiple repos

// ------
// BUILDS
// ------

export type BuildsDoc = {
  builds: { [buildId: string]: Build };
};

export type Build = {
  id: string;
  startTime: Date;
  result:
    | (Result<BuildOutput, string> & {
        finishTime: Date;
        stdout: string;
        stderr: string;
      })
    | null;
};

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type BuildOutput = {
  pdfUrl: AutomergeUrl | null;
  buildDirUrl: AutomergeUrl | null;
};

export type SuccessfulBuild = Build & { result: { ok: true } };
export function buildIsSuccessful(build: Build): build is SuccessfulBuild {
  return build.result?.ok || false;
}

export function getLatestBuild(doc: BuildsDoc): Build | undefined {
  // TODO: ooooo rel – select(`argmax(${doc.builds} .startTime)`)
  return R.pipe(
    doc.builds,
    Object.values,
    R.maxBy((build) => build.startTime.getTime())
  );
}

export function getLatestSuccessfulBuild(
  doc: BuildsDoc
): SuccessfulBuild | undefined {
  return R.pipe(
    doc.builds,
    Object.values,
    R.filter(buildIsSuccessful),
    R.maxBy((build) => build.startTime.getTime())
  );
}

// ----
// FILE
// ----

export type FileDoc = {
  contents: Uint8Array;
};

export async function getFileContents(
  repo: Repo,
  fileUrl: AutomergeUrl
): Promise<Uint8Array> {
  const fileHandle = repo.find<FileDoc>(fileUrl);
  const fileDoc = await fileHandle.doc();
  if (!fileDoc) {
    throw new Error(`file doc not found at ${fileUrl}`);
  }
  return fileDoc.contents;
}

export async function writeNewFile(
  repo: Repo,
  contents: Uint8Array
): Promise<AutomergeUrl> {
  const fileHandle = repo.create<FileDoc>({ contents });
  return fileHandle.url;
}
