import { Button } from "@/components/ui/button";
import { LocalSession, MarkdownDoc, User } from "../schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChangeFn,
  diff,
  getHeads,
  save,
  splice,
} from "@automerge/automerge/next";
import {
  Check,
  ChevronsUpDown,
  Download,
  GitFork,
  GitMerge,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import { getTitle, saveFile } from "../utils";
import { uuid } from "@automerge/automerge";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { DocHandle, isValidAutomergeUrl } from "@automerge/automerge-repo";

const initials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
};

type TentativeUser =
  | {
      _type: "existing";
      id: string;
    }
  | {
      _type: "new";
      name: string;
    }
  | {
      _type: "unknown";
    };

export const Navbar = ({
  doc,
  changeDoc,
  session,
  setSession,
  handle,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  session: LocalSession;
  setSession: (session: LocalSession) => void;
  handle: DocHandle<MarkdownDoc>;
}) => {
  const repo = useRepo();
  const [namePickerOpen, setNamePickerOpen] = useState(false);
  const [tentativeUser, setTentativeUser] = useState<TentativeUser>({
    _type: "unknown",
  });
  const [mergeDocUrl, setMergeDocUrl] = useState("");
  const users = doc.users;
  const sessionUser: User | undefined = users?.find(
    (user) => user.id === session?.userId
  );

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

  const cloneDoc = useCallback(() => {
    const clone = repo.clone(handle);

    // NOTE: for now I'm not deleting all comments;
    // this is so that we can simply merge back in the entire doc
    // without getting comments deleted.
    // Going forward, I think a better plan is to more selectively
    // merge in changes from a different doc (eg partial patches on text);
    // once we get there we can delete all comments in the fork.

    // delete all comments
    // clone.change((d) => {
    //   d.commentThreads = {};
    // });

    // open clone in new tab
    const cloneUrl = `${window.location.origin}/#${clone.url}`;
    window.open(cloneUrl, "_blank");
  }, [repo]);

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

  // sync session user to the local user state for the login process
  useEffect(() => {
    if (sessionUser) {
      setTentativeUser({ _type: "existing", id: sessionUser.id });
    }
  }, [sessionUser]);

  const title = getTitle(doc?.content ?? "");

  useEffect(() => {
    document.title = title;
  }, [title]);

  const mergeDoc = async () => {
    if (!isValidAutomergeUrl(mergeDocUrl)) {
      alert("Invalid document URL, please try again.");
      return;
    }
    const mergeDocHandle = repo.find<MarkdownDoc>(mergeDocUrl);
    try {
      const currentDoc = await handle.doc();

      // Make a new "rebased fork" which is the fork + any changes from this doc since the fork
      const rebaseForkHandle = repo.clone(mergeDocHandle);
      rebaseForkHandle.merge(handle);
      const rebaseForkDoc = await rebaseForkHandle.doc();

      // Now we can get a nice diff between the rebased fork and our doc
      const oldHeads = getHeads(currentDoc);
      const newHeads = getHeads(rebaseForkDoc);
      const patches = diff(rebaseForkDoc, oldHeads, newHeads);
      console.log(patches);

      handle.merge(mergeDocHandle);
    } catch (e) {
      console.error("Error merging document", e);
      console.error(e);
    }
  };

  const isMergeDocUrlValid = isValidAutomergeUrl(mergeDocUrl);

  if (!doc) {
    return <></>;
  }

  return (
    <div className="h-12 w-screen bg-white border-b border-gray-300 align-middle flex">
      <img
        className="h-8 my-2 ml-2"
        src="/assets/logo-favicon-310x310-transparent.png"
      />
      <div className="text-md my-3 select-none overflow-hidden overflow-ellipsis whitespace-nowrap">
        {title}
      </div>
      <div className="ml-auto px-8 py-1 flex gap-2">
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

        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" className="text-gray-500">
              <GitFork size={"20px"} className="mr-1" />
              Fork
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <GitFork className="inline" /> Fork
              </DialogTitle>
            </DialogHeader>
            <p>
              Forking this document will create a new document with the same
              contents. You can then edit the forked document independently,
              without affecting the contents of this doc.
            </p>
            <p>
              Later, if you'd like, you can merge back all of your changes into
              this document using the <GitMerge className="inline" /> Merge
              button.
            </p>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button type="submit" onClick={cloneDoc}>
                  Fork
                </Button>
              </DialogTrigger>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" className="text-gray-500">
              <GitMerge size={"20px"} className="mr-1" />
              Merge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <GitMerge className="inline" /> Merge
              </DialogTitle>
              <DialogDescription>
                Merge changes from a fork into this document
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                URL:
              </Label>
              <div className="col-span-3">
                <Input
                  placeholder="automerge:xyz123"
                  value={mergeDocUrl}
                  onChange={(e) => setMergeDocUrl(e.target.value)}
                ></Input>
                <div className="text-red-700 text-xs h-4 p-1">
                  {!isMergeDocUrlValid && mergeDocUrl.length > 0
                    ? "Invalid automerge doc URL"
                    : " "}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button
                  type="submit"
                  onClick={mergeDoc}
                  disabled={!isMergeDocUrlValid}
                >
                  Merge
                </Button>
              </DialogTrigger>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" className="px-2 py-0">
              <Avatar>
                {/* <AvatarImage src="https://github.com/shadcn.png" /> */}
                <AvatarFallback>
                  {sessionUser ? initials(sessionUser.name) : <UserIcon />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>
                Log in as existing user, or sign up with your name
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Log in:
                </Label>
                <Popover open={namePickerOpen} onOpenChange={setNamePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={namePickerOpen}
                      className="justify-between col-span-3"
                    >
                      {tentativeUser._type === "existing"
                        ? doc.users.find((user) => user.id === tentativeUser.id)
                            ?.name
                        : "Select user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => {
                              if (user.id !== sessionUser?.id) {
                                setTentativeUser({
                                  _type: "existing",
                                  id: user.id,
                                });
                              }
                              setNamePickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                session.userId === user.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {user.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-center text-sm text-gray-400">or</div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Sign up:
                </Label>
                <Input
                  placeholder="Your name here"
                  className="col-span-3"
                  value={
                    tentativeUser._type === "new" ? tentativeUser.name : ""
                  }
                  onFocus={() => {
                    setTentativeUser({ _type: "new", name: "" });
                    setNamePickerOpen(false);
                  }}
                  onChange={(e) => {
                    setTentativeUser({
                      _type: "new",
                      name: e.target.value,
                    });
                  }}
                ></Input>
              </div>
            </div>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button
                  type="submit"
                  onClick={() => {
                    if (tentativeUser._type === "existing") {
                      setSession({ userId: tentativeUser.id });
                    } else if (tentativeUser._type === "new") {
                      const user = {
                        id: uuid(),
                        name: tentativeUser.name,
                      };
                      changeDoc((doc) => {
                        doc.users.push(user);
                      });
                      setSession({ userId: user.id });
                    }
                  }}
                >
                  Save changes
                </Button>
              </DialogTrigger>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
