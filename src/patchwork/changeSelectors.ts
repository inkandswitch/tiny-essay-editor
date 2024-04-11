import * as A from "@automerge/automerge/next";
import { Annotation, Anchor } from "./schema";

export type ChangeSelector<D, A extends Anchor<D, V>, V> = {
  patchesToAnnotations(
    currentDoc: D,
    previousDoc: D,
    patches: A.Patch[]
  ): Annotation<D, V>[];

  anchorFromJson(anchor: any): A | undefined;
};
