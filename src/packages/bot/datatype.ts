import { DataType } from "@/os/datatypes";
import { ContactDoc, RegisteredContactDoc } from "@/os/explorer/account";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { markdownDataType, MarkdownDoc } from "@/packages/essay/datatype";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { Bot } from "lucide-react";

const BOT_AVATAR_URL = "automerge:uL1duhieqUV4qaeHGHX1dg8FnNy" as AutomergeUrl;

// SCHEMA

export type EssayEditingBotDoc = HasVersionControlMetadata<never, never> & {
  contactUrl: AutomergeUrl;
  promptUrl: AutomergeUrl;
};

// FUNCTIONS

export const essayEditingBotDatatype: DataType<
  EssayEditingBotDoc,
  never,
  never
> = {
  type: "patchwork:datatype",
  name: "Bot",
  isExperimental: true,
  icon: Bot,
  init: (doc: any, repo: Repo) => {
    const contactHandle = repo.create<RegisteredContactDoc>();
    const promptHandle = repo.create<MarkdownDoc>();

    contactHandle.change((contactDoc) => {
      contactDoc.type = "registered";
      contactDoc.name = "New Bot";
      contactDoc.avatarUrl = BOT_AVATAR_URL;
    });

    promptHandle.change((doc) => markdownDataType.init(doc, repo));
    promptHandle.change((promptDoc) => {
      promptDoc.content = "Replace all spelling errors in the document.";
    });

    doc.contactUrl = contactHandle.url;
    doc.promptUrl = promptHandle.url;
  },
  getTitle: async (doc: any, repo: Repo) => {
    const contactDoc = await repo.find<ContactDoc>(doc.contactUrl).doc();
    return contactDoc.type === "registered" ? contactDoc.name : "Untitled Bot";
  },
  markCopy: () => {
    // TODO: maybe should reach into the contact doc and change its name here.
    // ugh that requires passing the repo in...
  },
};
