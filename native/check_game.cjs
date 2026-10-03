// Static checks on the game (../index.html), light enough for the CI runner (no browser):
//   - every inline <script> block compiles (a syntax error names its line in index.html)
//   - PLAT_IDS has every key build_www.py and the shell rely on
//   - every store product id is fort_-prefixed (App Store product ids are unique per developer
//     account, and Euchre Unleashed already sells unprefixed ones)
//   - every window.Shell member the game calls exists in native/shell.js, so a rename on either
//     side fails here instead of silently no-oping on a device
//
// Run:  node native/check_game.cjs [path/to/index.html]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Inline <script> blocks with the 1-based line each starts on, for error messages.
function scriptBlocks(html) {
  const blocks = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] && /\bsrc\s*=/.test(m[1])) continue;
    const start = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;
    blocks.push({ code: m[2], line: start });
  }
  return blocks;
}

// Compiles each block; returns failure strings.
function compileBlocks(html, label) {
  const fails = [];
  const blocks = scriptBlocks(html);
  if (!blocks.length) fails.push(label + ': no inline <script> blocks found');
  for (const b of blocks) {
    try {
      // Offsetting by the block's line makes the reported line the one in the HTML file.
      new vm.Script(b.code, { filename: label, lineOffset: b.line - 1 });
    } catch (e) {
      const where = (e.stack || '').split('\n')[0];
      fails.push('syntax error in ' + where + ' :: ' + e.message);
    }
  }
  return { fails, count: blocks.length };
}

// The window.Shell members index.html uses, and the regex that finds each use in the game.
const CONTRACT = {
  native: /Shell\.native\b/,
  configure: /\.configure\(\{/,
  ready: /\.ready\(\)/,
  build: /\.build\b/,
  version: /\.version\b/,
  liveAds: /\.liveAds\b/,
  'app.onState': /\.app\.onState\(/,
  'ads.available': /\.ads\.available\(/,
  'ads.showRewarded': /\.ads\.showRewarded\(/,
  'ads.showInterstitial': /\.ads\.showInterstitial\(/,
  'iap.available': /\.iap\.available\(/,
  'iap.price': /\.iap\.price\(/,
  'iap.purchase': /\.iap\.purchase\(/,
  'iap.restore': /\.iap\.restore\(/,
  'iap.owned': /\.iap\.owned\(/,
  'notify.schedule': /\.notify\.schedule\(/,
  'notify.cancel': /\.notify\.cancel\(/,
  haptic: /\.haptic\(kind\)/,
  store: /Shell\.store\b/,
  'store.put': /\.put\(SAVE_KEY,/,
  'store.hydrate': /\.hydrate\(SAVE_KEY\)/,
  'gc.submitScore': /\.gc\.submitScore\(/,
  'gc.available': /\.gc\.available\(\)/,
  'gc.unlock': /\.gc\.unlock\(id\)/,
  'gc.showLeaderboard': /\.gc\.showLeaderboard\(id\)/,
  'gc.showAchievements': /\.gc\.showAchievements\(\)/,
  'review.available': /\.review\.available\(\)/,
  'review.request': /\.review\.request\(\)/,
  'cloud.available': /\.cloud\.available\(\)/,
  'cloud.get': /\.cloud\.get\(key\)/,
  'cloud.put': /\.cloud\.put\(key,json\)/
};

// window.Shell as the web build sees it (no Capacitor): the object shape is the same everywhere.
function loadShell() {
  const src = fs.readFileSync(path.join(__dirname, 'shell.js'), 'utf8');
  const noop = () => {};
  const doc = { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop };
  const ctx = vm.createContext({ document: doc, setTimeout: noop, clearTimeout: noop, console: { warn: noop, log: noop },
    localStorage: { length: 0, key: () => null, getItem: () => null, setItem: noop } });
  ctx.window = ctx;
  ctx.addEventListener = noop;
  vm.runInContext(src, ctx, { filename: 'shell.js' });
  return ctx.Shell;
}

function checkGame(html) {
  const fails = [];
  const ids = /const PLAT_IDS=\{([\s\S]*?)\n\};/.exec(html);
  if (!ids) fails.push('const PLAT_IDS={...}; not found');
  else {
    for (const k of ['admobApp', 'rewarded', 'interstitial', 'testRewarded', 'testInterstitial', 'rcKey', 'lbDaily', 'achPre', 'analytics']) {
      if (!new RegExp('^\\s*' + k + ":'[^']*'", 'm').test(ids[1])) fails.push('PLAT_IDS.' + k + ' missing');
    }
    if (!/^\s*icloud:(true|false)\b/m.test(ids[1])) fails.push('PLAT_IDS.icloud missing (true or false)');
    // iCloud needs the key-value-store entitlement (and the App ID's iCloud capability) or CI signing / the sync fails
    const ent = path.join(__dirname, 'ios', 'App', 'App', 'App.entitlements');
    const kvs = fs.existsSync(ent) && /com\.apple\.developer\.ubiquity-kvstore-identifier/.test(fs.readFileSync(ent, 'utf8'));
    if (/^\s*icloud:true\b/m.test(ids[1]) && !kvs) fails.push('PLAT_IDS.icloud is true but App.entitlements has no ubiquity-kvstore-identifier');
    const an = /^\s*analytics:'([^']*)'/m.exec(ids[1]);
    if (an && an[1] && !/^https:\/\/\S+$/.test(an[1])) fails.push('PLAT_IDS.analytics must be empty or an https URL');
  }
  const skus = [...html.matchAll(/\bsku:'([^']+)'/g)].map((m) => m[1]);
  if (skus.length !== 7) fails.push('expected 7 store products (5 gem packs, starter, noads), found ' + skus.length + ': ' + skus.join(', '));
  const bad = skus.filter((s) => !/^fort_[a-z0-9_]+$/.test(s));
  if (bad.length) fails.push('store product ids must be fort_-prefixed: ' + bad.join(', '));
  if (new Set(skus).size !== skus.length) fails.push('duplicate store product ids: ' + skus.join(', '));

  const shell = loadShell();
  for (const [member, use] of Object.entries(CONTRACT)) {
    const v = member.split('.').reduce((o, k) => (o == null ? undefined : o[k]), shell);
    if (v === undefined) fails.push('window.Shell.' + member + ' is missing from native/shell.js');
    if (!use.test(html)) fails.push('index.html no longer uses Shell.' + member + ' the way check_game.cjs expects (' + use + ')');
  }
  return { fails, skus };
}

module.exports = { scriptBlocks, compileBlocks, checkGame };

if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
  const html = fs.readFileSync(file, 'utf8');
  const c = compileBlocks(html, path.basename(file));
  const g = checkGame(html);
  const fails = c.fails.concat(g.fails);
  console.log('check_game: ' + c.count + ' script block(s) compiled, ' + g.skus.length + ' products (' + g.skus.join(', ') + '), ' +
    Object.keys(CONTRACT).length + ' Shell members');
  fails.forEach((f) => console.log('  FAIL ' + f));
  process.exit(fails.length ? 1 : 0);
}
