import { HasPatchworkMetadata } from "@/patchwork/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";

export type EssayEditingBotDoc = HasPatchworkMetadata<never, never> & {
  contactUrl: AutomergeUrl;
  promptUrl: AutomergeUrl;
};
