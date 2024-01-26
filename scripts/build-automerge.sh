#!/bin/bash

# Target directory to store the tarballs
tar_dir="$(pwd)/vendor/tarballs"

# build automerge
# cd ./vendor/repos/automerge/javascript/e2e
# yarn e2e buildjs
# cd -

# Navigate to automerge, pack with a specified filename, and move to target directory
(cd "vendor/repos/automerge/javascript" && yarn pack --filename "automerge.tgz" && mv "automerge.tgz" "$tar_dir")
cd -

# Navigate to automerge-wasm, pack with a specified filename, and move to target directory
(cd "vendor/repos/automerge/rust/automerge-wasm" && yarn pack --filename "automerge-wasm.tgz" && mv "automerge-wasm.tgz" "$tar_dir")
cd -

echo "Packing and moving complete."
exit 0;
