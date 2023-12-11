import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  avatarVariants,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AutomergeUrl,
  DocHandle,
  DocumentId,
  Repo,
  stringifyAutomergeUrl,
} from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { EventEmitter } from "eventemitter3";
import { Copy, Eye, EyeOff, User as UserIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type VariantProps } from "class-variance-authority";
import { ChangeEvent, useEffect, useMemo, useReducer, useState } from "react";

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
  change: () => void;
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

    // listen for changed profileUrl caused by other tabs
    window.addEventListener("storage", async (event) => {
      if (event.key === PROFILE_URL) {
        const newProfileUrl = event.newValue as AutomergeUrl;

        // try to see if profile is already loaded
        const profileHandle = this.#repo.find<ProfileDoc>(newProfileUrl);
        const profileDoc = await profileHandle.doc();
        if (profileDoc.contactUrl) {
          this.logIn(newProfileUrl);
          return;
        }

        // ... otherwise wait until contactUrl of profile is loaded
        profileHandle.on("change", ({ doc }) => {
          if (doc.contactUrl) {
            this.logIn(newProfileUrl);
          }
        });
      }
    });
  }

  async logIn(profileUrl: AutomergeUrl) {
    // override old profileUrl
    localStorage.setItem(PROFILE_URL, profileUrl);

    const profileHandle = this.#repo.find<ProfileDoc>(profileUrl);
    const profileDoc = await profileHandle.doc();
    const contactHandle = this.#repo.find<ContactDoc>(profileDoc.contactUrl);

    this.#contactHandle.change((oldContact: AnonymousContactDoc) => {
      if (oldContact.type === "anonymous") {
        oldContact.claimedBy = contactHandle.url;
      }
    });

    this.#contactHandle = contactHandle;
    this.#handle = profileHandle;
    this.emit("change");
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
    const profileHandle = this.#repo.create<ProfileDoc>();
    const contactHandle = this.#repo.create<ContactDoc>();

    profileHandle.change((profile) => {
      profile.contactUrl = contactHandle.url;
    });

    contactHandle.change((contact) => {
      contact.type = "anonymous";
    });

    localStorage.setItem(PROFILE_URL, profileHandle.url);

    this.#handle = profileHandle;
    this.#contactHandle = contactHandle;

    this.emit("change");
  }

  get handle() {
    return this.#handle;
  }

  get contactHandle() {
    return this.#contactHandle;
  }
}

const PROFILE_URL = "tinyEssayEditor:profileUrl";

let CURRENT_PROFILE: Promise<Profile>;

async function getProfile(repo: Repo) {
  if (!repo.storageSubsystem) {
    throw new Error("cannot create profile without storage");
  }

  if (CURRENT_PROFILE) {
    const currentProfile = await CURRENT_PROFILE;
    if (currentProfile) {
      return currentProfile;
    }
  }

  const profileUrl = localStorage.getItem(PROFILE_URL) as AutomergeUrl;

  // try to load existing profile
  if (profileUrl) {
    CURRENT_PROFILE = new Promise<Profile>(async (resolve) => {
      const profileHandle = repo.find<ProfileDoc>(profileUrl);
      const contactHandle = repo.find<ContactDoc>(
        (await profileHandle.doc()).contactUrl
      );
      resolve(new Profile(repo, profileHandle, contactHandle));
    });

    return CURRENT_PROFILE;
  }

  // ... otherwise create a new one
  const profileHandle = repo.create<ProfileDoc>();
  const contactHandle = repo.create<ContactDoc>();

  profileHandle.change((profile) => {
    profile.contactUrl = contactHandle.url;
  });

  contactHandle.change((contact) => {
    contact.type = "anonymous";
  });

  localStorage.setItem(PROFILE_URL, profileHandle.url);
  const newProfile = new Profile(repo, profileHandle, contactHandle);
  CURRENT_PROFILE = Promise.resolve(newProfile);
  return newProfile;
}

function useForceUpdate() {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}

export function useProfile(): Profile | undefined {
  const repo = useRepo();
  const [profile, setProfile] = useState<Profile | undefined>(undefined);

  const forceUpdate = useForceUpdate();

  useEffect(() => {
    getProfile(repo).then(setProfile);
  }, [repo]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    profile.on("change", forceUpdate);

    return () => {
      profile.off("change", forceUpdate);
    };
  }, [profile]);

  return profile;
}

function useProfileDoc(): ProfileDoc {
  const profile = useProfile();
  const [profileDoc] = useDocument<ProfileDoc>(profile?.handle.url);
  return profileDoc;
}

export function useSelf(): ContactDoc {
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

interface ContactAvatarProps extends VariantProps<typeof avatarVariants> {
  url?: AutomergeUrl;
  showName?: boolean;
  name?: string;
  avatar?: File;
}

export const ContactAvatar = ({
  name: nameOverride,
  avatar: avatarOverride,
  url,
  showName = false,
  size,
}: ContactAvatarProps) => {
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

  const avatarBlobUrl = useBlobUrl(contact?.avatarUrl);
  const avatarOverrideUrl = useMemo(
    () => avatarOverride && URL.createObjectURL(avatarOverride),
    [avatarOverride]
  );

  const avatarUrl = avatarOverrideUrl
    ? avatarOverrideUrl
    : url && contact?.avatarUrl
    ? avatarBlobUrl
    : undefined;
  const name = nameOverride ?? contact?.name;

  return (
    <div className="flex items-center gap-1.5">
      <Avatar size={size}>
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback>{name ? initials(name) : <UserIcon />}</AvatarFallback>
      </Avatar>

      {showName && <b>{name ?? "Anonymous"}</b>}
    </div>
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
  const [profileDocId, setProfileDocId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProfilePickerTab>(
    ProfilePickerTab.SignUp
  );
  const [showProfileUrl, setShowProfileUrl] = useState(false);
  const [isCopyTooltipOpen, setIsCopyTooltipOpen] = useState(false);
  const [profileToLogin] = useDocument<ProfileDoc>(
    profileDocId && stringifyAutomergeUrl(profileDocId as DocumentId)
  );
  const [contactToLogin] = useDocument<ContactDoc>(profileToLogin?.contactUrl);

  // initialize form values if already logged in
  useEffect(() => {
    if (self && self.type === "registered" && name === "") {
      setName(self.name);
    }
  }, [self]);

  const onSubmit = () => {
    switch (activeTab) {
      case ProfilePickerTab.LogIn:
        profile.logIn(stringifyAutomergeUrl(profileDocId as DocumentId));
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
    navigator.clipboard.writeText(profile.handle.documentId);

    setIsCopyTooltipOpen(true);

    setTimeout(() => {
      setIsCopyTooltipOpen(false);
    }, 1000);
  };

  const isSubmittable =
    (activeTab === ProfilePickerTab.SignUp && name) ||
    (activeTab === ProfilePickerTab.LogIn &&
      profileDocId &&
      profileToLogin?.contactUrl &&
      contactToLogin?.type === "registered");

  const isLoggedIn = self?.type === "registered";

  return (
    <Dialog>
      <DialogTrigger>
        <ContactAvatar url={profile?.contactHandle.url} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="items-center">
          {isLoggedIn ? (
            <ContactAvatar
              size="lg"
              url={profile?.contactHandle.url}
              name={name}
              avatar={avatar}
            ></ContactAvatar>
          ) : activeTab === "signUp" ? (
            <ContactAvatar name={name} avatar={avatar} size={"lg"} />
          ) : (
            <ContactAvatar
              url={profileToLogin?.contactUrl}
              size="lg"
            ></ContactAvatar>
          )}
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={ProfilePickerTab.SignUp}
            className="w-full"
            onValueChange={(tab) => setActiveTab(tab as ProfilePickerTab)}
            value={activeTab}
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
                <p className="text-gray-500 text-justify pb-2 text-sm">
                  To login, paste your secret login token.
                </p>
                <p className="text-gray-500 text-justify pb-2 text-sm mb-2">
                  You can find your token by accessing the profile dialog on any
                  device where you are currently logged in.
                </p>

                <Label htmlFor="profileUrl">Secret login token</Label>

                <div className="flex gap-1.5">
                  <Input
                    className="cursor-"
                    id="profileUrl"
                    value={profileDocId}
                    onChange={(evt) => {
                      setProfileDocId(evt.target.value);
                    }}
                    type={showProfileUrl ? "text" : "password"}
                  />
                  <Button variant="ghost" onClick={onToggleShowProfileUrl}>
                    {showProfileUrl ? <Eye /> : <EyeOff />}
                  </Button>
                </div>
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
              <Label htmlFor="picture">Secret login token</Label>

              <div className="flex gap-1.5">
                <Input
                  onFocus={(e) => e.target.select()}
                  value={profile.handle.documentId}
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
                    <TooltipTrigger
                      onClick={onCopy}
                      onBlur={() => setIsCopyTooltipOpen(false)}
                    >
                      <Copy />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copied</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <p className="text-gray-500 text-justify pt-2 text-sm">
                To log in on another device, copy your secret login token and
                paste it into the login screen on the other device.
              </p>
              <p className="text-gray-500 text-justify pt-2 text-sm">
                ⚠️ Keep your token secret from others!
              </p>
            </div>
          </>
        )}
        <DialogFooter className="gap-1.5">
          {isLoggedIn && (
            <DialogTrigger asChild>
              <Button onClick={onLogout} variant="secondary">
                Sign out
              </Button>
            </DialogTrigger>
          )}
          <DialogTrigger asChild>
            <Button type="submit" onClick={onSubmit} disabled={!isSubmittable}>
              {isLoggedIn
                ? "Save"
                : activeTab === "signUp"
                ? "Sign up"
                : `Log in${
                    contactToLogin && contactToLogin.type === "registered"
                      ? ` as ${contactToLogin.name}`
                      : ""
                  }`}
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
