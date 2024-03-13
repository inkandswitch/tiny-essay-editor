import { HasPatchworkMetadata } from "@/patchwork/schema";

export type RichTeeDoc = {
  title: string;
  text: string;
} & HasPatchworkMetadata;
