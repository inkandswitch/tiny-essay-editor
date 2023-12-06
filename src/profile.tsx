import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useEffect, useState } from "react";

interface ProfileDoc {
  contactUrl: AutomergeUrl;
}

interface ContactDoc {
  name?: string;
}

interface ProfileEvents {
  logOut: (profile: Profile) => void;
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

  async logIn(profileUrl: string) {}

  async signUp(name: string) {
    this.contactHandle.change((contact) => {
      contact.name = name;
    });
  }

  async logOut() {
    // delete old profile id
    await this.#repo.storageSubsystem.save(NAMESPACE, "profileUrl", null);

    // replace with current profile with new anonymous
    const anonymousProfile = await getProfile(this.#repo);

    this.emit("logOut", anonymousProfile);
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
    console.log("trigger set profile");
    getProfile(repo).then(setProfile);
  }, [repo]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const onLogout = (profile: Profile) => {
      setProfile(profile);
    };

    profile.on("logOut", onLogout);

    return () => {
      profile.off("logOut", onLogout);
    };
  }, [profile]);

  return profile;
}

function useProfileDoc(): ProfileDoc {
  const profile = useProfile();
  const [profileDoc] = useDocument<ProfileDoc>(profile?.handle.url);

  console.log("useProfile", profile?.handle.url);

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

enum ProfilePickerTab {
  LogIn = "logIn",
  SignUp = "signUp",
}

export const ProfilePicker = () => {
  const profile = useProfile();
  const self = useSelf();
  const [name, setName] = useState<string>("");
  const [profileUrl, setProfileUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProfilePickerTab>(
    ProfilePickerTab.SignUp
  );

  // initialize values
  useEffect(() => {
    if (self?.name && name === "") {
      setName(self.name);
    }
  }, [self]);

  console.log("self", self);

  const onSubmit = () => {
    switch (activeTab) {
      case ProfilePickerTab.LogIn:
        console.log("log in", profileUrl);
        break;

      case ProfilePickerTab.SignUp:
        profile.signUp(name);
        break;
    }
  };

  const onLogout = () => {
    profile.logOut();
  };

  const isSubmittable =
    (activeTab === ProfilePickerTab.SignUp && name) ||
    (activeTab === ProfilePickerTab.LogIn &&
      profileUrl &&
      isValidAutomergeUrl(profileUrl));

  const isLoggedIn = self?.name;

  return (
    <Dialog>
      <DialogTrigger>
        <Avatar>
          <AvatarFallback>
            {self && self.name ? initials(self.name) : <UserIcon />}
          </AvatarFallback>
        </Avatar>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>

        {!isLoggedIn && (
          <Tabs
            defaultValue={ProfilePickerTab.SignUp}
            className="w-full"
            onChange={(...args) => console.log(args)}
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
            </TabsContent>
            <TabsContent value={ProfilePickerTab.LogIn}>
              <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
                <Label htmlFor="profileUrl">Profile Url</Label>
                <Input
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
          <div className="grid w-full max-w-sm items-center gap-1.5 py-4">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(evt) => setName(evt.target.value)}
            />
          </div>
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
