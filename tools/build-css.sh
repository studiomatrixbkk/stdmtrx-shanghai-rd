#!/bin/sh
# Build the Tailwind CSS for index.html into a content-hashed file and point
# index.html + sw.js at it. A new file name per build means a phone can never
# pair new HTML with an old cached CSS file (service worker or GitHub's CDN).
# Usage: sh tools/build-css.sh   (then bump VERSION in sw.js and deploy)
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp)
npx -y tailwindcss@3.4.17 -i tools/tailwind.in.css -o "$tmp" --content index.html --minify
hash=$(shasum "$tmp" | cut -c1-8)
rm -f vendor/tailwind.css vendor/tailwind-*.css
mv "$tmp" "vendor/tailwind-$hash.css"
chmod 644 "vendor/tailwind-$hash.css"
sed -i '' -E "s#vendor/tailwind(-[0-9a-f]{8})?\.css#vendor/tailwind-$hash.css#g" index.html sw.js
echo "built vendor/tailwind-$hash.css"
