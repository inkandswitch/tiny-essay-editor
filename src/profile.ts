import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { EventEmitter } from "eventemitter3";

import { useEffect, useReducer, useState } from "react";
import { uploadFile } from "./utils";

export interface ProfileDoc {
  contactUrl: AutomergeUrl;
}

export interface AnonymousContactDoc {
  type: "anonymous";
  claimedBy?: AutomergeUrl;
}

export interface RegisteredContactDoc {
  type: "registered";
  name: string;
  avatarUrl?: AutomergeUrl;
}

export type ContactDoc = AnonymousContactDoc | RegisteredContactDoc;

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
