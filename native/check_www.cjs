// Checks the built native/www (python build_www.py) before `npx cap sync ios` copies it into the app:
//   - capacitor.js then shell.js load right after <head>, before the game's first script, so
//     window.Shell exists when Plat is defined; the build stamp matches BUILD_NUMBER when CI sets it
//   - capacitor.js is the @capacitor/core runtime (registerPlugin) and shell.js is native/shell.js
//   - nothing is fetched from the network (the app must run offline): no http(s) src/href, and
//     the Google Fonts link was swapped for the bundled fonts/fonts.css
//   - every file the page references by relative path, and every url() in fonts.css, is in www/
//   - every inline script still compiles, and the game checks in check_game.cjs pass on the built page
//
// Run:  python native/build_www.py && node native/check_www.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { compileBlocks, checkGame } = require('./check_game.cjs');

const WWW = path.join(__dirname, 'www');
const fails = [];
const need = (cond, msg) => { if (!cond) fails.push(msg); };

const indexFile = path.join(WWW, 'index.html');
if (!fs.existsSync(indexFile)) {
  console.log('check_www: www/index.html not found; run python native/build_www.py first');
  process.exit(1);
}
const html = fs.readFileSync(indexFile, 'utf8');

// head injection
const head = html.indexOf('<head>');
const cap = html.indexOf('<script src="capacitor.js"></script>');
const shell = html.indexOf('<script src="shell.js"></script>');
const firstGame = html.indexOf('<script>', shell);
need(head >= 0 && cap > head && shell > cap, 'capacitor.js and shell.js must load, in that order, right after <head>');
need(firstGame > shell, 'shell.js must load before the first game script');
need(!/\r/.test(html), 'www/index.html has CR line endings');
const bn = (process.env.BUILD_NUMBER || '').trim();
if (/^\d+$/.test(bn)) need(html.includes('window.FORT_BUILD="' + bn + '";'), 'build stamp missing: window.FORT_BUILD="' + bn + '"');

// runtime + shell
const capJs = path.join(WWW, 'capacitor.js');
need(fs.existsSync(capJs) && /registerPlugin/.test(fs.readFileSync(capJs, 'utf8')), 'www/capacitor.js is not the @capacitor/core runtime');
const shellJs = path.join(WWW, 'shell.js');
need(fs.existsSync(shellJs) && fs.readFileSync(shellJs, 'utf8') === fs.readFileSync(path.join(__dirname, 'shell.js'), 'utf8'),
  'www/shell.js differs from native/shell.js (rebuild www)');

// offline: no network loads
const remote = [...html.matchAll(/\b(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi)].map((m) => m[0]);
need(!remote.length, 'the page loads from the network: ' + remote.join(', '));
need(!html.includes('fonts.googleapis.com'), 'Google Fonts link still present');
need(html.includes('<link rel="stylesheet" href="fonts/fonts.css">'), 'fonts/fonts.css link missing');

// local references present
const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)["']/gi)].map((m) => m[1])
  .filter((r) => !/^(data:|blob:|javascript:|mailto:|https?:)/i.test(r) && !r.includes('${'));
const fontsCss = path.join(WWW, 'fonts', 'fonts.css');
if (fs.existsSync(fontsCss)) {
  for (const m of fs.readFileSync(fontsCss, 'utf8').matchAll(/url\(([^)]+)\)/g)) refs.push('fonts/' + m[1].replace(/["']/g, ''));
}
const missing = [...new Set(refs)].filter((r) => !fs.existsSync(path.join(WWW, r.replace(/^\.\//, ''))));
need(!missing.length, 'referenced but missing from www: ' + missing.join(', '));

// the game itself
const c = compileBlocks(html, 'www/index.html');
const g = checkGame(html);
fails.push(...c.fails, ...g.fails);

console.log('check_www: ' + c.count + ' script block(s) compiled, ' + new Set(refs).size + ' local file(s) present, shell ' +
  (shell > 0 ? 'injected' : 'MISSING') + (bn ? ', build ' + bn : ''));
fails.forEach((f) => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
