import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";

export type EssayEditingBotDoc = HasVersionControlMetadata<never, never> & {
  contactUrl: AutomergeUrl;
  promptUrl: AutomergeUrl;
};
