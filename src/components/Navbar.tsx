import { Button } from "@/components/ui/button";
import { LocalSession, MarkdownDoc, User } from "../schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChangeFn, getHeads, save } from "@automerge/automerge/next";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
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
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";

import { Label } from "@/components/ui/label";
import { SetStateAction, useCallback, useEffect, useState } from "react";
import { getTitle, saveFile } from "../utils";
import { uuid } from "@automerge/automerge";
import { DocHandle, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { SyncIndicator } from "./SyncIndicator";
import { useRepo } from "@automerge/automerge-repo-react-hooks";

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
  handle,
  doc,
  changeDoc,
  session,
  setSession,
  showDiff,
  setShowDiff,
}: {
  handle: DocHandle<MarkdownDoc>;
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  session: LocalSession;
  setSession: (session: LocalSession) => void;
  showDiff: boolean;
  setShowDiff: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const repo = useRepo();
  const [namePickerOpen, setNamePickerOpen] = useState(false);
  const [tentativeUser, setTentativeUser] = useState<TentativeUser>({
    _type: "unknown",
  });
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

  // fork and open clone in new tab
  const forkDoc = useCallback(() => {
    const clone = repo.clone(handle);
    clone.change((doc) => {
      // @ts-expect-error need to figure out how to make the type mutable in change blocks
      doc.forkMetadata.parent = {
        url: handle.url,
        forkedAtHeads: getHeads(doc),
      };
    });

    // @ts-expect-error window global
    window.openDocumentInNewTab(clone.url);
  }, [repo, handle]);

  const goToParent = () => {
    if (!doc?.forkMetadata?.parent) return;

    // @ts-expect-error using window global
    window.openDocumentInNewTab(doc.forkMetadata.parent.url);
  };

  const shareToParent = () => {
    const parentUrl = doc?.forkMetadata?.parent?.url;
    if (!parentUrl || !isValidAutomergeUrl(parentUrl)) {
      return;
    }
    const parent = repo.find<MarkdownDoc>(parentUrl);
    parent.change((doc) => {
      if (!doc.forkMetadata.knownForks.includes(handle.url)) {
        // @ts-expect-error need to figure out how to make the type mutable in change blocks
        doc.forkMetadata.knownForks.push(handle.url);
      }
    });
  };

  const mergeToParent = () => {
    const parentUrl = doc?.forkMetadata?.parent?.url;
    if (!parentUrl || !isValidAutomergeUrl(parentUrl)) {
      return;
    }
    const parent = repo.find<MarkdownDoc>(parentUrl);
    parent.merge(handle);
  };

  const knownForks = doc?.forkMetadata?.knownForks ?? [];

  if (!doc) {
    return <></>;
  }

  return (
    <div>
      <div className="h-11 w-screen border-b border-gray-300 bg-white align-middle flex text-gray-800">
        <Menubar className="border-none bg-none">
          <MenubarMenu>
            <MenubarTrigger className="px-2 mr-[-10px]">
              <img
                className="h-6"
                // @ts-expect-error window global set in entrypoint file
                src={window.logoImageUrl}
              />{" "}
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => alert("not implemented yet")}>
                About this OS
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => alert("not implemented yet")}>
                System Settings
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => alert("not implemented yet")}>
                Log out
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="font-bold px-2">
              Tiny Essay Editor
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => alert("not implemented yet")}>
                About Tiny Essay Editor
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => alert("not implemented yet")}>
                Settings
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              {/* TODO: this approach to making a new doc doesn't work for TEE/TR */}
              <MenubarItem onClick={() => window.open("/", "_blank")}>
                New
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  const automergeURLToOpen = prompt("Automerge URL:");
                  if (
                    automergeURLToOpen === null ||
                    automergeURLToOpen === ""
                  ) {
                    return;
                  }
                  const newUrl = `${document.location.origin}${document.location.pathname}#${automergeURLToOpen}`;
                  // @ts-expect-error window global
                  window.openDocumentInNewTab(newUrl);
                }}
              >
                Open
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => forkDoc()}>Fork</MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>Go to fork</MenubarSubTrigger>
                <MenubarSubContent>
                  {knownForks.length === 0 && (
                    <MenubarItem disabled>No known forks</MenubarItem>
                  )}
                  {knownForks.map((forkUrl) => (
                    <MenubarItem
                      // @ts-expect-error window global
                      onClick={() => window.openDocumentInNewTab(forkUrl)}
                    >
                      {forkUrl}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
              <MenubarItem
                disabled={!doc?.forkMetadata?.parent}
                onClick={() => goToParent()}
              >
                Go to parent
              </MenubarItem>
              <MenubarItem
                disabled={!doc?.forkMetadata?.parent}
                onClick={() => {
                  shareToParent();
                }}
              >
                Share fork to parent
              </MenubarItem>
              <MenubarItem
                disabled={!doc?.forkMetadata?.parent}
                onClick={() => {
                  mergeToParent();
                }}
              >
                Merge to parent
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  navigator.clipboard.writeText(handle.url);
                }}
              >
                Copy Automerge Doc URL
              </MenubarItem>
              <MenubarItem onClick={downloadDoc}>
                Download <MenubarShortcut>⌘ S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                disabled
                onClick={() => alert("Not implemented yet.")}
              >
                Share
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarCheckboxItem
                checked={showDiff}
                onClick={() => setShowDiff((prev) => !prev)}
              >
                Show changes
              </MenubarCheckboxItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                onClick={() =>
                  window.open(
                    "https://github.com/inkandswitch/tiny-essay-editor",
                    "_blank"
                  )
                }
              >
                GitHub Repo
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <div className="ml-auto px-8 py-1 flex gap-2 items-center">
          <Menubar className="border-none bg-none">
            <SyncIndicator handle={handle} />
          </Menubar>

          {/* TODO: make the user dialog into a menu more consistent with rest */}
          <Dialog>
            <DialogTrigger>
              <Avatar className="h-8">
                <AvatarFallback>
                  {sessionUser ? initials(sessionUser.name) : <UserIcon />}
                </AvatarFallback>
              </Avatar>
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
                  <Popover
                    open={namePickerOpen}
                    onOpenChange={setNamePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={namePickerOpen}
                        className="justify-between col-span-3"
                      >
                        {tentativeUser._type === "existing"
                          ? doc.users.find(
                              (user) => user.id === tentativeUser.id
                            )?.name
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
                          // @ts-expect-error need to figure out how to make the type mutable in change blocks
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
      {/* <div className="h-12 w-screen bg-white border-b border-gray-300 align-middle flex">
        <img
          className="h-8 my-2 ml-2"
          // @ts-expect-error window global set in entrypoint file
          src={window.logoImageUrl}
        />

        <div className="text-md my-3 select-none overflow-hidden overflow-ellipsis whitespace-nowrap">
          {title}
        </div>
      </div> */}
    </div>
  );
};
