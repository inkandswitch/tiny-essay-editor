#!/bin/bash

# Target directory to store the tarballs
tar_dir="$(pwd)/vendor/tarballs"

# build automerge
cd ./vendor/repos/automerge/javascript/e2e
yarn e2e buildjs
cd -

# Directory to pack
dir="vendor/repos/automerge/javascript"

# Navigate to directory, pack with a specified filename, and move to target directory
(cd "$dir" && yarn pack --filename "automerge.tgz" && mv "automerge.tgz" "$tar_dir")

echo "Packing and moving complete."
exit 0;
