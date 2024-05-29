import { ContactDoc, RegisteredContactDoc } from "@/os/explorer/account";
import { MarkdownDatatype } from "@/datatypes/essay/datatype";
import { MarkdownDoc } from "@/datatypes/essay/schema";
import { type DataType } from "@/os/datatypes";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { Bot } from "lucide-react";
import { EssayEditingBotDoc } from "./schema";

const BOT_AVATAR_URL = "automerge:uL1duhieqUV4qaeHGHX1dg8FnNy" as AutomergeUrl;

export const EssayEditingBotDatatype: DataType<
  EssayEditingBotDoc,
  never,
  never
> = {
  id: "bot",
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

    promptHandle.change((doc) => MarkdownDatatype.init(doc, repo));
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
