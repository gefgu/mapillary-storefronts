#!/usr/bin/env bash
# Build the web app and publish web/dist to the gh-pages branch (no GitHub Actions needed).
# Usage: scripts/deploy-gh-pages.sh   (override the target with DEPLOY_REMOTE=...)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${DEPLOY_REMOTE:-git@github.com:gefgu/mapillary-storefronts.git}"

# Node version from .nvmrc, when nvm is available
if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; cd "$ROOT"; nvm use >/dev/null; fi

cd "$ROOT/web"
npm ci
npm run build

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP"
touch "$TMP/.nojekyll"

cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-$(git -C "$ROOT" config user.name || echo deploy)}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-$(git -C "$ROOT" config user.email || echo deploy@example.com)}" \
    commit -q -m "Deploy $(git -C "$ROOT" rev-parse --short HEAD) to GitHub Pages"
git push -f "$REMOTE" gh-pages
echo "Published. Set Settings -> Pages -> Source to 'Deploy from a branch': gh-pages / (root)."
