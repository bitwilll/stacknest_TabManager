#!/bin/sh
# Builds two packages from the same files:
#
#   dist/stacknest-<version>.zip           the Chrome Web Store upload (no "key")
#   dist/stacknest-<version>-install.zip   for installing by hand: unzip, then Load unpacked
#                                          (keeps the "key"; unzipped copy: dist/stacknest-<version>-install/)
#
#   sh scripts/package.sh
#
# Both are an allowlist, never a copy of the folder. They carry only what the extension
# runs: manifest.json, newtab.html, css/, js/, fonts/, audio/
# and icons/*.png. Personal backups, docs, the "new design" sketches, .git and .DS_Store
# can't get in, because nothing outside the list is copied. Upload only the store zip this
# prints, never an older hand-made one.
#
# Why the two differ only in "key": the key fixes the extension ID, and Google sign-in (Drive
# backup) works only for the ID its OAuth client is registered to (js/authConfig.js ›
# OAUTH_EXTENSION_IDS). The store assigns its own ID and rejects packages that carry a key, so
# the store zip has none. A copy installed by hand WITHOUT the key gets a random ID, and
# Google answers Connect with "Access blocked: … request is invalid (Error 400)". So never
# share the store zip for a hand install; share the -install zip.
set -eu
cd "$(dirname "$0")/.."

command -v node >/dev/null 2>&1 || { echo "package: node is required (it validates manifest.json)" >&2; exit 1; }
command -v zip  >/dev/null 2>&1 || { echo "package: zip is required" >&2; exit 1; }

VER=$(node -e 'try { process.stdout.write(String(JSON.parse(require("fs").readFileSync("manifest.json", "utf8")).version || "")); }
  catch (e) { console.error(`package: manifest.json is not valid JSON: ${e.message}`); process.exit(1); }')
case "$VER" in
  *[!0-9.]*|"") echo "package: manifest version \"$VER\" is not 1-4 dot-separated integers" >&2; exit 1 ;;
esac
OUT="dist/stacknest-$VER"
ZIP="dist/stacknest-$VER.zip"
INST="dist/stacknest-$VER-install"
IZIP="dist/stacknest-$VER-install.zip"
rm -rf "$OUT" "$ZIP" "$INST" "$IZIP"
mkdir -p "$OUT/js" "$OUT/icons"

# ——— 1. the allowlist ———
cp newtab.html offscreen.html "$OUT/"
cp -R css fonts "$OUT/"
if [ -d audio ]; then cp -R audio "$OUT/"; fi   # CC0 lounge music + CREDITS.txt
cp icons/*.png "$OUT/icons/"
cp js/*.js "$OUT/js/"

# ——— 2. manifest: validate, check store limits, strip the dev key ———
node - "$OUT" <<'JS'
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const fail = (m) => { console.error(`package: ${m}`); process.exit(1); };
let m;
try { m = JSON.parse(fs.readFileSync('manifest.json', 'utf8')); } catch (e) { fail(`manifest.json is not valid JSON: ${e.message}`); }
if (m.manifest_version !== 3) fail('manifest_version must be 3');
if (!m.name || m.name.length > 75) fail(`name must be 1-75 characters (is ${m.name ? m.name.length : 0})`);
if (m.short_name && m.short_name.length > 12) fail(`short_name must be 12 characters or fewer (is ${m.short_name.length})`);
if (!m.description || m.description.length > 132) fail(`description must be 1-132 characters (is ${m.description ? m.description.length : 0})`);
if (!/^\d+(\.\d+){0,3}$/.test(m.version) || m.version.split('.').some((n) => +n > 65535)) fail(`version "${m.version}" is not a valid extension version`);
if (m.host_permissions && m.host_permissions.length) console.warn(`package: note, host_permissions present: ${m.host_permissions.join(', ')}`);
delete m.key;
// every file the manifest names must be inside the package
const named = [
  ...Object.values(m.icons || {}),
  m.background && m.background.service_worker,
  ...Object.values(m.chrome_url_overrides || {}),
  m.action && m.action.default_popup,
  ...Object.values((m.action && m.action.default_icon) || {}),
].filter(Boolean);
for (const f of named) if (!fs.existsSync(path.join(out, f))) fail(`manifest names ${f}, which is not in the package`);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
console.log(`manifest  ${m.name} ${m.version}  description ${m.description.length}/132  key stripped`);
JS

# ——— 3. the shipped code must stand on its own ———
node - "$OUT" <<'JS'
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const fail = (m) => { console.error(`package: ${m}`); process.exit(1); };
const exists = (from, rel) => fs.existsSync(path.join(path.dirname(path.join(out, from)), rel.split(/[?#]/)[0]));
const problems = [];
// newtab.html: local scripts and stylesheets only
const html = fs.readFileSync(path.join(out, 'newtab.html'), 'utf8');
for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
  if (/^[a-z]+:|^\/\//i.test(src)) problems.push(`newtab.html loads a remote script: ${src}`);
  else if (!exists('newtab.html', src)) problems.push(`newtab.html loads ${src}, which is not in the package`);
}
for (const [, href] of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) {
  if (/^[a-z]+:|^\/\//i.test(href)) problems.push(`newtab.html links a remote file: ${href}`);
  else if (!exists('newtab.html', href)) problems.push(`newtab.html links ${href}, which is not in the package`);
}
if (/\son[a-z]+="/i.test(html)) problems.push('newtab.html has an inline event handler (blocked by the extension CSP)');
if (/<script\b(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html)) problems.push('newtab.html has an inline <script> (blocked by the extension CSP)');
// every relative import resolves inside the package
for (const f of fs.readdirSync(path.join(out, 'js')).filter((n) => n.endsWith('.js'))) {
  const rel = `js/${f}`, src = fs.readFileSync(path.join(out, rel), 'utf8');
  for (const [, spec] of src.matchAll(/\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    if (!exists(rel, spec)) problems.push(`${rel} imports ${spec}, which is not in the package`);
  }
  for (const [, spec] of src.matchAll(/\b(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    if (!exists(rel, spec)) problems.push(`${rel} statically imports ${spec}, which is not in the package`);
  }
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(src)) problems.push(`${rel} uses eval/new Function (the store treats it as remote code)`);
  if (/\bimport\s*\(\s*['"]https?:/.test(src) || /\bimportScripts\s*\(/.test(src)) problems.push(`${rel} loads remote code`);
}
// stylesheet url()s resolve inside the package
for (const f of fs.readdirSync(path.join(out, 'css')).filter((n) => n.endsWith('.css'))) {
  // drop quoted data: URIs first — an inline SVG can hold its own url(#id) references
  const rel = `css/${f}`, src = fs.readFileSync(path.join(out, rel), 'utf8').replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/g, '');
  for (const [, u] of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (/^(data:|#)/.test(u)) continue;
    if (/^[a-z]+:|^\/\//i.test(u)) problems.push(`${rel} loads a remote file: ${u}`);
    else if (!exists(rel, u)) problems.push(`${rel} references ${u}, which is not in the package`);
  }
}
if (problems.length) fail('the package would not run on its own:\n  ' + problems.join('\n  '));
console.log('code      imports, scripts and stylesheet urls all resolve inside the package; no eval, no remote code');
JS

# ——— 4. zip it, flat, with manifest.json at the root ———
find "$OUT" \( -name '.DS_Store' -o -name '._*' -o -name 'Thumbs.db' \) -exec rm -f {} +
(cd "$OUT" && zip -qrXD "../stacknest-$VER.zip" .)
unzip -Z1 "$ZIP" | grep -qx 'manifest.json' || { echo "package: manifest.json is not at the zip root" >&2; exit 1; }
# belt and braces: no dotfiles, no data, keys or nested archives
BAD=$(unzip -Z1 "$ZIP" | grep -vx 'manifest.json' | grep -E '(^|/)\.|\.(md|json|pem|crx|zip|map)$' || true)
if [ -n "$BAD" ]; then
  echo "package: the zip holds files that must not ship:" >&2
  echo "$BAD" >&2
  exit 1
fi
if unzip -p "$ZIP" manifest.json | grep -q '"key"'; then echo "package: the packaged manifest still has a key" >&2; exit 1; fi

# ——— 5. the hand-install build: the same files, with the key put back ———
# The key must produce an ID Google signs in (js/authConfig.js › OAUTH_EXTENSION_IDS), or
# every hand install would hit "Access blocked" on Connect. Refuse to build otherwise.
cp -R "$OUT" "$INST"
node - "$INST" <<'JS'
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const inst = process.argv[2];
const fail = (m) => { console.error(`package: ${m}`); process.exit(1); };
const { key } = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
if (!key) fail('manifest.json has no "key", so a hand install would get a random extension ID and Google sign-in would fail');
// Chrome's ID: the first 32 hex digits of SHA-256 over the DER public key, each digit 0-f spelled a-p
const hex = crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32);
const id = [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const list = (fs.readFileSync('js/authConfig.js', 'utf8').match(/OAUTH_EXTENSION_IDS\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
const ids = [...list.matchAll(/['"]([a-p]{32})['"]/g)].map((x) => x[1]);
if (!ids.includes(id)) fail(`the manifest key gives extension ID ${id}, which js/authConfig.js › OAUTH_EXTENSION_IDS doesn't list (${ids.join(', ') || 'empty'}); Google sign-in would refuse it`);
const { manifest_version, ...rest } = JSON.parse(fs.readFileSync(path.join(inst, 'manifest.json'), 'utf8'));
fs.writeFileSync(path.join(inst, 'manifest.json'), JSON.stringify({ manifest_version, key, ...rest }, null, 2) + '\n');
console.log(`install   key kept, extension ID ${id} (registered for Google sign-in)`);
JS
(cd "$INST" && zip -qrXD "../stacknest-$VER-install.zip" .)
unzip -p "$IZIP" manifest.json | grep -q '"key"' || { echo "package: the install zip lost its key" >&2; exit 1; }

echo
unzip -l "$ZIP"
echo
echo "store upload:   $ZIP"
echo "hand install:   $IZIP   (unzip it, then chrome://extensions › Load unpacked)"
