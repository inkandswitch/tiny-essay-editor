import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

// todo: this is a hack we need access to the storage from the auth provider
export const storage = new IndexedDBStorageAdapter();
