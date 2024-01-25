#!/bin/bash

# Target directory to store the tarballs
tar_dir="$(pwd)/vendor/tarballs"

cd vendor/repos/automerge-repo
pnpm install
pnpm build
cd -

# Array of directories to pack
directories=(
  "vendor/repos/automerge-repo/packages/automerge-repo"
  "vendor/repos/automerge-repo/packages/automerge-repo-react-hooks"
  "vendor/repos/automerge-repo/packages/automerge-repo-network-broadcastchannel"
  "vendor/repos/automerge-repo/packages/automerge-repo-network-websocket"
  "vendor/repos/automerge-repo/packages/automerge-repo-storage-indexeddb"
)

# Loop through directories and pack them
for dir in "${directories[@]}"; do
  # Extracting the last part of the directory as a name for the tarball
  name=$(basename "$dir")
  # Navigate to directory, pack with a specified filename, and move to target directory
  (cd "$dir" && yarn pack --filename "$name.tgz" && mv "$name.tgz" "$tar_dir")
done

echo "Packing and moving complete."
exit 0;