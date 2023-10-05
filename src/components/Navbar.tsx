import { Button } from "@/components/ui/button";
import { LocalSession, MarkdownDoc, User } from "../schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChangeFn } from "@automerge/automerge/next";
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
import { useEffect, useState } from "react";

const initials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
};

const saveFile = async (blob) => {
  try {
    // @ts-expect-error - experimental API
    const handle = await window.showSaveFilePicker({
      suggestedName: "index.md",
      types: [
        {
          accept: {
            "text/markdown": [".md"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle;
  } catch (err) {
    console.error(err.name, err.message);
  }
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
  const users = doc.users;
  const sessionUser: User | undefined = users?.find(
    (user) => user.id === session?.userId
  );

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
  }, []);

  if (!doc) {
    return <></>;
  }

  const downloadDoc = () => {
    const file = new Blob([doc.content], { type: "text/markdown" });
    saveFile(file);
  };

  return (
    <div className="h-12 w-screen bg-white border-b border-gray-300 align-middle flex">
      <img
        className="h-8 my-2 ml-2"
        src="/assets/logo-favicon-310x310-transparent.png"
      />
      <div className="text-md my-3 select-none">Tiny Essay Editor</div>
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
                Choose your name from the list of users on this doc.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Popover open={namePickerOpen} onOpenChange={setNamePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={namePickerOpen}
                      className="w-[200px] justify-between"
                    >
                      {sessionUser ? sessionUser.name : "Select user..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search users..." />
                      <CommandEmpty>No user found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={(currentValue) => {
                              if (currentValue !== sessionUser?.id) {
                                setSession({ userId: currentValue });
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
            </div>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button type="submit">Save changes</Button>
              </DialogTrigger>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
