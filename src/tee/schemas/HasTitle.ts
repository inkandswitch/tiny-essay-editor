import { SchemaToType } from "@/automerge-repo-schema-utils/utils";
import { Schema as S } from "@effect/schema";

export const HasTitleV1 = S.struct({
  title: S.string,
});

export type HasTitleV1 = SchemaToType<typeof HasTitle>;

export const HasTitle = HasTitleV1;
export type HasTitle = HasTitleV1;
