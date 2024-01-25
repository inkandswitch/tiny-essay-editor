#!/bin/bash

# Check and create vendor directory
[ ! -d "vendor" ] && mkdir vendor

# Check and create vendor/repos directory
[ ! -d "vendor/repos" ] && mkdir vendor/repos

# Check and create vendor/tarballs directory
[ ! -d "vendor/tarballs" ] && mkdir vendor/tarballs

# Clone automerge if it doesn't exist
[ ! -d "vendor/repos/automerge" ] && git clone git@github.com:automerge/automerge.git vendor/repos/automerge

# Clone automerge-repo if it doesn't exist
[ ! -d "vendor/repos/automerge-repo" ] && git clone git@github.com:automerge/automerge-repo.git vendor/repos/automerge-repo
exit 0;