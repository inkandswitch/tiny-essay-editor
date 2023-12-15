import {
  AutomergeUrl,
  DocHandle,
  NetworkAdapter,
  Repo,
  isValidAutomergeUrl,
  parseAutomergeUrl,
} from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { EventEmitter } from "eventemitter3";

import { useEffect, useReducer, useState } from "react";
import { uploadFile, objectToUint8Array } from "./utils";
import * as Auth from "@localfirst/auth";
import { AuthProvider } from "@localfirst/auth-provider-automerge-repo";
import { storage } from "./storage";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

export interface AccountDoc {
  contactUrl: AutomergeUrl;
}

export interface AnonymousContactDoc {
  type: "anonymous";
}

export interface RegisteredContactDoc {
  type: "registered";
  name: string;
  avatarUrl?: AutomergeUrl;
}

export type ContactDoc = AnonymousContactDoc | RegisteredContactDoc;

interface AccountEvents {
  change: () => void;
}

interface ContactProps {
  name: string;
  avatar: File;
}

interface AccountConfig {
  repo: Repo;
  accountHandle: DocHandle<AccountDoc>;
  contactHandle: DocHandle<ContactDoc>;
  user: Auth.UserWithSecrets;
  device: Auth.DeviceWithSecrets;
  team: Auth.Team;
}

class Account extends EventEmitter<AccountEvents> {
  #repo: Repo;
  #accountHandle: DocHandle<AccountDoc>;
  #contactHandle: DocHandle<ContactDoc>;
  #authProvider: AuthProvider;

  constructor({
    repo,
    accountHandle,
    contactHandle,
    user,
    device,
    team,
  }: AccountConfig) {
    super();

    this.#repo = repo;
    this.#accountHandle = accountHandle;
    this.#contactHandle = contactHandle;

    const authProvider = (this.#authProvider = new AuthProvider({
      user,
      device,
      storage,
    }));

    authProvider.addTeam(team);

    repo.networkSubsystem.addNetworkAdapter(
      authProvider.wrap(
        new BrowserWebSocketClientAdapter(
          "ws://localhost:3030"
        ) as NetworkAdapter
      )
    );

    // listen for changed accountUrl caused by other tabs
    // todo: adapt to auth
    /*
    window.addEventListener("storage", async (event) => {
      if (event.key === LOGGED_IN_ACCOUNT) {
        const newAccountUrl = event.newValue as AutomergeUrl;

        // try to see if account is already loaded
        const accountHandle = this.#repo.find<AccountDoc>(newAccountUrl);
        const accountDoc = await accountHandle.doc();
        if (accountDoc.contactUrl) {
          this.logIn(newAccountUrl);
          return;
        }

        // ... otherwise wait until contactUrl of account is loaded
        accountHandle.on("change", ({ doc }) => {
          if (doc.contactUrl) {
            this.logIn(newAccountUrl);
          }
        });
      }
    }); */
  }

  async logIn(accountUrl: AutomergeUrl) {
    // override old accountUrl
    localStorage.setItem(LOGGED_IN_ACCOUNT, accountUrl);

    const accountHandle = this.#repo.find<AccountDoc>(accountUrl);
    const accountDoc = await accountHandle.doc();
    const contactHandle = this.#repo.find<ContactDoc>(accountDoc.contactUrl);

    this.#contactHandle = contactHandle;
    this.#accountHandle = accountHandle;
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
    const accountHandle = this.#repo.create<AccountDoc>();
    const contactHandle = this.#repo.create<ContactDoc>();

    accountHandle.change((account) => {
      account.contactUrl = contactHandle.url;
    });

    contactHandle.change((contact) => {
      contact.type = "anonymous";
    });

    localStorage.setItem(LOGGED_IN_ACCOUNT, accountHandle.url);

    this.#accountHandle = accountHandle;
    this.#contactHandle = contactHandle;

    this.emit("change");
  }

  get accountHandle() {
    return this.#accountHandle;
  }

  get contactHandle() {
    return this.#contactHandle;
  }
}

const LOGGED_IN_ACCOUNT_DATA_KEY = "tinyEssayEditor:loggedInAccountData";

let CURRENT_ACCOUNT: Promise<Account>;

async function getAccount(repo: Repo) {
  if (!repo.storageSubsystem) {
    throw new Error("cannot create account without storage");
  }

  if (CURRENT_ACCOUNT) {
    const currentAccount = await CURRENT_ACCOUNT;
    if (currentAccount) {
      return currentAccount;
    }
  }

  const accountData = loadLoggedInAccountData();

  // try to load existing account
  if (accountData) {
    const { user, device, team, accountUrl } = accountData;

    CURRENT_ACCOUNT = new Promise<Account>(async (resolve) => {
      const accountHandle = repo.find<AccountDoc>(accountUrl);
      const contactHandle = repo.find<ContactDoc>(
        (await accountHandle.doc()).contactUrl
      );
      resolve(
        new Account({ repo, accountHandle, contactHandle, user, device, team })
      );
    });

    return CURRENT_ACCOUNT;
  }

  CURRENT_ACCOUNT = new Promise<Account>(async (resolve) => {
    // ... otherwise create a new one
    const accountHandle = repo.create<AccountDoc>();
    const contactHandle = repo.create<ContactDoc>();

    accountHandle.change((account) => {
      account.contactUrl = contactHandle.url;
    });

    contactHandle.change((contact) => {
      contact.type = "anonymous";
    });

    const user = Auth.createUser("user");
    const device = Auth.createDevice(user.userId, "device");

    // create a team
    const team = Auth.createTeam("team", { user, device });

    // get the server's public keys
    const response = await fetch(`http://localhost:3030/keys`);
    const keys = await response.json();

    // add the server's public keys to the team
    team.addServer({ host: "localhost", keys });

    // register the team with the server
    await fetch(`http://localhost:3030/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serializedGraph: team.save(),
        teamKeyring: team.teamKeyring(),
      }),
    });

    storeLoggedInAccountData({
      accountUrl: accountHandle.url,
      user,
      device,
      team,
    });

    resolve(
      new Account({ repo, accountHandle, contactHandle, user, device, team })
    );
  });
  return CURRENT_ACCOUNT;
}

interface SerializedTeam {
  serializedGraph: Uint8Array;
  keyring: Auth.Keyring;
}

interface RawAccountData {
  accountUrl: AutomergeUrl;
  user: Auth.UserWithSecrets;
  device: Auth.DeviceWithSecrets;
  serializedTeam: SerializedTeam;
}

interface AccountData {
  accountUrl: AutomergeUrl;
  user: Auth.UserWithSecrets;
  device: Auth.DeviceWithSecrets;
  team: Auth.Team;
}

function loadLoggedInAccountData(): AccountData | undefined {
  const raw = localStorage.getItem(LOGGED_IN_ACCOUNT_DATA_KEY);
  if (raw) {
    const { user, device, accountUrl, serializedTeam } = JSON.parse(
      raw
    ) as RawAccountData;

    return {
      accountUrl,
      user,
      device,
      team: new Auth.Team({
        source: objectToUint8Array(serializedTeam.serializedGraph),
        context: { user, device },
        teamKeyring: serializedTeam.keyring,
      }),
    };
  }
}

function storeLoggedInAccountData({
  accountUrl,
  user,
  device,
  team,
}: AccountData) {
  const rawAccountData: RawAccountData = {
    accountUrl,
    user,
    device,
    serializedTeam: {
      serializedGraph: team.save(),
      keyring: team.teamKeyring(),
    },
  };

  localStorage.setItem(
    LOGGED_IN_ACCOUNT_DATA_KEY,
    JSON.stringify(rawAccountData)
  );
}

function useForceUpdate() {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}

export function useCurrentAccount(): Account | undefined {
  const repo = useRepo();
  const [account, setAccount] = useState<Account | undefined>(undefined);

  const forceUpdate = useForceUpdate();

  useEffect(() => {
    getAccount(repo).then(setAccount);
  }, [repo]);

  useEffect(() => {
    if (!account) {
      return;
    }

    account.on("change", forceUpdate);

    return () => {
      account.off("change", forceUpdate);
    };
  }, [account]);

  return account;
}

function useCurrentAccountDoc(): AccountDoc {
  const account = useCurrentAccount();
  const [accountDoc] = useDocument<AccountDoc>(account?.accountHandle.url);
  return accountDoc;
}

export function useSelf(): ContactDoc {
  const accountDoc = useCurrentAccountDoc();
  const [contactDoc] = useDocument<ContactDoc>(accountDoc?.contactUrl);

  return contactDoc;
}

// Helpers to convert an automerge URL to/from an Account Token that the user can
// paste in to login on another device.
// The doc ID is the only part of the URL actually used by the system,
// the rest is just for humans to understand what this string is for.
export function automergeUrlToAccountToken(
  url: AutomergeUrl,
  name: string
): string {
  const { documentId } = parseAutomergeUrl(url);
  return `account:${encodeURIComponent(name)}/${documentId}`;
}

// returns undefined if the token can't be parsed as an automerge URL
export function accountTokenToAutomergeUrl(
  token: string
): AutomergeUrl | undefined {
  const match = token.match(/^account:([^/]+)\/(.+)$/);
  if (!match || !match[2]) {
    return undefined;
  }
  const documentId = match[2];
  const url = `automerge:${documentId}`;
  if (!isValidAutomergeUrl(url)) {
    return undefined;
  }
  return url;
}
