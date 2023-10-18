import { Button } from "@/components/ui/button";
import { LocalSession, MarkdownDoc, User } from "../schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChangeFn, save } from "@automerge/automerge/next";
import { Check, ChevronsUpDown, Download } from "lucide-react";
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
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  session: LocalSession;
  setSession: (session: LocalSession) => void;
}) => {
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

  if (!doc) {
    return <></>;
  }

  return (
    <div className="h-12 w-screen bg-white border-b border-gray-300 align-middle flex">
      <img
        className="h-8 my-2 ml-2"
        src="/assets/logo-favicon-310x310-transparent.png"
      />
      <div className="text-md my-3 select-none">{title}</div>
      <div className="ml-auto px-8 py-1 flex gap-2">
        <Button onClick={downloadDoc} variant="ghost" className="text-gray-500">
          <Download size={"20px"} />
        </Button>
        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" className="px-2 py-0">
              <Avatar>
                {/* <AvatarImage src="https://github.com/shadcn.png" /> */}
                <AvatarFallback>
                  {sessionUser ? initials(sessionUser.name) : "??"}
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
