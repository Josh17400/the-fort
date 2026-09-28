// `npx cap sync ios` on Windows writes the plugin paths in ios/App/CapApp-SPM/Package.swift with
// backslashes, which Swift Package Manager on macOS cannot resolve. Capacitor runs this after every
// sync (package.json "capacitor:sync:after"), so a sync on Windows leaves the same file a Mac writes.
// On macOS it finds nothing to change.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'ios', 'App', 'CapApp-SPM', 'Package.swift');

if (fs.existsSync(FILE)) {
  const src = fs.readFileSync(FILE, 'utf8');
  const out = src.replace(/path: "([^"]*)"/g, (m, p) => 'path: "' + p.replace(/\\/g, '/') + '"');
  if (out !== src) {
    fs.writeFileSync(FILE, out);
    console.log('fix_spm_paths: Package.swift plugin paths now use forward slashes');
  }
}
