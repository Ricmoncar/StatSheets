#!/bin/sh
# Builds the /next/ preview (https://ricmoncar.github.io/StatSheets/next/) into
# next/ at the repo root. GitHub Pages serves the main branch as it is, so the
# preview goes live when next/ reaches main. The preview reads and writes the
# next_ test collections, and takes sounds/, baddies/ and the old pages it
# links to from the old site one folder up.
set -e
cd "$(dirname "$0")/../../web"
npx ng build -c next
rm -rf ../next
cp -r dist/statsheets/browser ../next
echo "next/ rebuilt"
