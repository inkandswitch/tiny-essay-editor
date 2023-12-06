import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Copy } from "lucide-react";
import {
  AutomergeUrl,
  DocHandle,
  Repo,
  isValidAutomergeUrl,
} from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { User as UserIcon } from "lucide-react";
import { EventEmitter } from "eventemitter3";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect, useState, ChangeEvent, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProfileDoc {
  contactUrl: AutomergeUrl;
}

interface AnonymousContactDoc {
  type: "anonymous";
  claimedBy?: AutomergeUrl;
}

interface RegisteredContactDoc {
  type: "registered";
  name: string;
  avatarUrl?: AutomergeUrl;
}

type ContactDoc = AnonymousContactDoc | RegisteredContactDoc;

interface ProfileEvents {
  changeProfile: (profile: Profile) => void;
}

interface ContactProps {
  name: string;
  avatar: File;
}

class Profile extends EventEmitter<ProfileEvents> {
  #repo: Repo;
  #handle: DocHandle<ProfileDoc>;
  #contactHandle: DocHandle<ContactDoc>;

  constructor(
    repo: Repo,
    handle: DocHandle<ProfileDoc>,
    contactHandle: DocHandle<ContactDoc>
  ) {
    super();

    this.#repo = repo;
    this.#handle = handle;
    this.#contactHandle = contactHandle;
  }

  async logIn(profileUrl: AutomergeUrl) {
    // override old profileUrl
    await this.#repo.storageSubsystem.save(
      NAMESPACE,
      "profileUrl",
      new TextEncoder().encode(profileUrl)
    );

    const newProfile = await getProfile(this.#repo);

    this.#contactHandle.change((oldContact: AnonymousContactDoc) => {
      if (oldContact.type === "anonymous") {
        oldContact.claimedBy = profileUrl;
      }
    });

    this.emit("changeProfile", newProfile);
  }

  async signUp({ name, avatar }: ContactProps) {
    let avatarUrl: AutomergeUrl;
    if (avatar) {
      avatarUrl = await uploadFile(this.#repo, avatar);
    }

    this.contactHandle.change((contact: RegisteredContactDoc) => {
      contact.type = "registered";
      contact.name = name;

      if (avatarUrl) {
        contact.avatarUrl = avatarUrl;
      }
    });
  }

  async logOut() {
    // delete old profile id
    await this.#repo.storageSubsystem.save(NAMESPACE, "profileUrl", null);

    // replace with current profile with new anonymous
    const anonymousProfile = await getProfile(this.#repo);

    this.emit("changeProfile", anonymousProfile);
  }

  get handle() {
    return this.#handle;
  }

  get contactHandle() {
    return this.#contactHandle;
  }
}

const NAMESPACE = "TinyEssayEditor";

let currentProfilesMap = new WeakMap<Repo, Promise<Profile>>();

async function getProfile(repo: Repo) {
  if (!repo.storageSubsystem) {
    throw new Error("cannot create profile without storage");
  }

  const rawProfileUrl = await repo.storageSubsystem.load(
    NAMESPACE,
    "profileUrl"
  );

  const currentProfile = await currentProfilesMap.get(repo);

  // try to load existing profile
  if (rawProfileUrl) {
    const profileUrl = new TextDecoder().decode(rawProfileUrl) as AutomergeUrl;

    if (currentProfile && currentProfile.handle.url === profileUrl) {
      return currentProfile;
    }

    const promise = new Promise<Profile>(async (resolve) => {
      const profileHandle = repo.find<ProfileDoc>(profileUrl);
      const contactHandle = repo.find<ContactDoc>(
        (await profileHandle.doc()).contactUrl
      );
      resolve(new Profile(repo, profileHandle, contactHandle));
    });

    currentProfilesMap.set(repo, promise);
    return promise;
  }

  // ... otherwise create a new one
  const profileHandle = repo.create<ProfileDoc>();
  const contactHandle = repo.create<ContactDoc>();

  profileHandle.change((profile) => {
    profile.contactUrl = contactHandle.url;
  });

  const promise = new Promise<Profile>(async (resolve) => {
    await repo.storageSubsystem.save(
      NAMESPACE,
      "profileUrl",
      new TextEncoder().encode(profileHandle.url)
    );
    resolve(new Profile(repo, profileHandle, contactHandle));
  });

  currentProfilesMap.set(repo, promise);
  return promise;
}

function useProfile(): Profile | undefined {
  const repo = useRepo();
  const [profile, setProfile] = useState<Profile | undefined>(undefined);

  useEffect(() => {
    getProfile(repo).then(setProfile);
  }, [repo]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const onLogout = (profile: Profile) => {
      setProfile(profile);
    };

    profile.on("changeProfile", onLogout);

    return () => {
      profile.off("changeProfile", onLogout);
    };
  }, [profile]);

  return profile;
}

function useProfileDoc(): ProfileDoc {
  const profile = useProfile();
  const [profileDoc] = useDocument<ProfileDoc>(profile?.handle.url);
  return profileDoc;
}

function useSelf(): ContactDoc {
  const profileDoc = useProfileDoc();
  const [contactDoc] = useDocument<ContactDoc>(profileDoc?.contactUrl);

  return contactDoc;
}

const initials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("");
};

interface AvatarProps {
  url: AutomergeUrl;
}

export const ContactAvatar = ({ url }: AvatarProps) => {
  const [maybeAnonymousContact] = useDocument<ContactDoc>(url);
  const [registeredContact] = useDocument<RegisteredContactDoc>(
    maybeAnonymousContact?.type === "anonymous"
      ? maybeAnonymousContact.claimedBy
      : undefined
  );

  const contact: RegisteredContactDoc =
    maybeAnonymousContact?.type === "registered"
      ? maybeAnonymousContact
      : registeredContact;

  const avatarUrl = useBlobUrl(contact?.avatarUrl);

  return (
    <Avatar>
      <AvatarImage src={avatarUrl} alt={contact?.name} />
      <AvatarFallback>
        {contact && contact.name ? initials(contact.name) : <UserIcon />}
      </AvatarFallback>
    </Avatar>
  );
};

enum ProfilePickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

export const ProfilePicker = () => {
  const profile = useProfile();
  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [avatar, setAvatar] = useState<File>();
  const [profileUrl, setProfileUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProfilePickerTab>(
    ProfilePickerTab.SignUp
  );
  const [showProfileUrl, setShowProfileUrl] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case ProfilePickerTab.LogIn:
        profile.logIn(profileUrl as AutomergeUrl);
        break;

      case ProfilePickerTab.SignUp:
        profile.signUp({ name, avatar });
        break;
    }
  };

  const onLogout = () => {
    profile.logOut();
  };

  const onFilesChanged = (e: ChangeEvent<HTMLInputElement>) => {
    setAvatar(!e.target.files ? undefined : e.target.files[0]);
  };

  const onToggleShowProfileUrl = () => {
    setShowProfileUrl((showProfileUrl) => !showProfileUrl);
  };

  const onCopy = () => {
    navigator.clipboard.writeText(profile.handle.url);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === ProfilePickerTab.SignUp && name) ||
    (activeTab === ProfilePickerTab.LogIn &&
      profileUrl &&
      isValidAutomergeUrl(profileUrl));

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <ContactAvatar url={profile?.contactHandle.url} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={ProfilePickerTab.SignUp}
            className="w-full"
            onValueChange={(tab) => setActiveTab(tab as ProfilePickerTab)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={ProfilePickerTab.SignUp}>Sign up</TabsTrigger>
              <TabsTrigger value={ProfilePickerTab.LogIn}>Log in</TabsTrigger>
            </TabsList>
            <TabsContent value={ProfilePickerTab.SignUp}>
              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(evt) => setName(evt.target.value)}
                />
              </div>

              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={onFilesChanged}
                />
              </div>
            </TabsContent>
            <TabsContent value={ProfilePickerTab.LogIn}>
              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="profileUrl">Profile Url</Label>
                <Input
                  className="cursor-"
                  id="profileUrl"
                  value={profileUrl}
                  onChange={(evt) => {
                    setProfileUrl(evt.target.value);
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        {isLoggedIn && (
          <>
            <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(evt) => setName(evt.target.value)}
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Avatar</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={onFilesChanged}
              />
            </div>

            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Profile URL</Label>
              <div className="flex gap-1.5">
                <Input
                  onFocus={(e) => e.target.select()}
                  value={profile.handle.url}
                  id="avatar"
                  type={showProfileUrl ? "text" : "password"}
                  accept="image/*"
                  onChange={onFilesChanged}
                />

                <Button variant="ghost" onClick={onToggleShowProfileUrl}>
                  {showProfileUrl ? <Eye /> : <EyeOff />}
                </Button>

                <TooltipProvider>
                  <Tooltip open={isCopyTooltipOpen}>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        onClick={onCopy}
                        onBlur={() => setIsCopyTooltipOpen(false)}
                      >
                        <Copy />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copied</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </>
        )}
        <DialogFooter>
          {isLoggedIn && (
            <DialogTrigger asChild>
              <Button onClick={onLogout}>Log out</Button>
            </DialogTrigger>
          )}
          <DialogTrigger asChild>
            <Button type="submit" onClick={onSubmit} disabled={!isSubmittable}>
              {isLoggedIn
                ? "Save"
                : activeTab === "signUp"
                ? "Sign up"
                : "Log in"}
            </Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface FileDoc {
  type: string;
  data: ArrayBuffer;
}

const uploadFile = async (repo: Repo, file: File): Promise<AutomergeUrl> => {
  const reader = new FileReader();
  const fileDocHandle = repo.create<FileDoc>();

  const isLoaded = new Promise((resolve) => {
    reader.onload = (event) => {
      fileDocHandle.change((fileDoc) => {
        fileDoc.type = file.type;
        fileDoc.data = new Uint8Array(event.target.result as ArrayBuffer);
      });

      resolve(true);
    };
  });

  reader.readAsArrayBuffer(file);

  await isLoaded;
  return fileDocHandle.url;
};

const useBlobUrl = (url: AutomergeUrl) => {
  const [file] = useDocument<FileDoc>(url);

  return useMemo(() => {
    if (!file || !file.data || !file.type) {
      return;
    }

    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    return url;
  }, [file?.data, file?.type]);
};
