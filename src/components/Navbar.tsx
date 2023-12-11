import { Button } from "@/components/ui/button";
import { save } from "@automerge/automerge/next";
import { Download, Plus } from "lucide-react";
import { MarkdownDoc } from "../schema";

import { DocHandle } from "@automerge/automerge-repo";
import { useCallback, useEffect } from "react";
import { getTitle, saveFile } from "../utils";
import { SyncIndicator } from "./generic/SyncIndicator";
import { ProfilePicker } from "./generic/ProfilePicker";

export const Navbar = ({
  handle,
  doc,
}: {
  handle: DocHandle<MarkdownDoc>;
  doc: MarkdownDoc;
}) => {
  const downloadDoc = useCallback(() => {
    const file = new Blob([doc.content], { type: "text/markdown" });
    saveFile(file, "index.md", [
      {
        accept: {
          "text/markdown": [".md"],
        },
      },
    ]);
  }, [doc.content]);

  useEffect(() => {
    // @ts-expect-error window global
    window.saveAutomergeFile = () => {
      const file = new Blob([save(doc)], { type: "application/octet-stream" });
      saveFile(file, "index.automerge", [
        {
          accept: {
            "application/octet-stream": [".automerge"],
          },
        },
      ]);
    };
  }, [doc]);

  // handle cmd-s for saving to local file
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        downloadDoc();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [downloadDoc]);

  const title = getTitle(doc?.content ?? "");

  useEffect(() => {
    document.title = title;
  }, [title]);

  if (!doc) {
    return <></>;
  }

  return (
    <div className="h-12 w-screen bg-white border-b border-gray-300 align-middle flex">
      <img
        className="h-8 my-2 ml-2"
        // @ts-expect-error window global set in entrypoint file
        src={window.logoImageUrl}
      />

      <div className="text-md my-3 select-none overflow-hidden overflow-ellipsis whitespace-nowrap">
        {title}
      </div>

      <div className="ml-auto px-8 py-1 flex gap-2 items-center">
        <SyncIndicator handle={handle} />
        <Button
          onClick={() => window.open("/", "_blank")}
          variant="ghost"
          className="text-gray-500"
        >
          <Plus size={"20px"} className="mr-2" />{" "}
          <span className="hidden md:inline-block">New</span>
        </Button>
        <Button onClick={downloadDoc} variant="ghost" className="text-gray-500">
          <Download size={"20px"} className="mr-2" />{" "}
          <div className="hidden md:inline-block">Download</div>
        </Button>
        <ProfilePicker />
      </div>
    </div>
  );
};
