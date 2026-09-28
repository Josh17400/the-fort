// The game's Plat seam (index.html) against a scripted window.Shell, in the real page: what the iOS
// app runs, minus the device. test_plat.py injects this file right after <head>, where build_www.py
// puts shell.js, so the fake Shell is in place before the game's script defines Plat.
//
//   boot     the native save copy replaces an empty localStorage before anything renders; configure
//            gets PLAT_IDS and the fort_ product ids; owned purchases rehydrate quietly; splash lifted
//   seam     every save() goes to Shell.store.put with the same JSON localStorage holds
//   ads      Plat.ad / Plat.interstitial map Shell results; no fill shows a toast; dev flag ignored
//   store    buy grants on ok only, a store error toasts, a cancel is silent; restore sets flags only
//   device   notify / cancel / haptic / Game Center score reach the Shell with the right arguments
//   life     the app going to the background saves and pauses a running battle
//   ui       no developer toggle in the app; the Settings build line shows version and build
//
// Result in document.title: PLAT pass=N fail=M [failed names]
(function () {
  var calls = [];
  var rec = function (name, args) { calls.push({ name: name, args: args }); };
  var BOOT_SAVE = JSON.stringify({ bank: 5e4, best: 33, tkills: 3000, lv: { dmg: 8, rate: 6, walls: 4, squad: 3, vision: 5, auto: 3, hp: 5, arty: 2, nade: 2 },
    rs: { dmg: 1, squad: 1 }, rp: 40, rsv: 1, runs: 20, gems: 77, gemv: 1, set: { blurPause: true } });
  var next = { rewarded: { rewarded: true }, shown: { shown: true }, purchase: { ok: true }, restore: ['fort_starter'], owned: ['fort_noads'] };
  var stateCb = null;
  window.__plat = { calls: calls, next: next, state: function (v) { stateCb(v); } };
  window.Shell = {
    native: true, platform: 'ios', build: '7', version: '1.0.0', liveAds: false,
    configure: function (c) { rec('configure', c); },
    ready: function () { rec('ready'); },
    app: { onState: function (cb) { stateCb = cb; cb(true); }, active: function () { return true; } },
    ads: {
      available: function () { return true; },
      showRewarded: function () { rec('showRewarded'); return Promise.resolve(next.rewarded); },
      showInterstitial: function () { rec('showInterstitial'); return Promise.resolve(next.shown); }
    },
    iap: {
      available: function () { return true; },
      price: function (id) { return id === 'fort_noads' ? '4,49 €' : null; },
      purchase: function (id) { rec('purchase', id); return Promise.resolve(next.purchase); },
      restore: function () { rec('restore'); return next.restore instanceof Error ? Promise.reject(next.restore) : Promise.resolve(next.restore); },
      owned: function () { rec('owned'); return Promise.resolve(next.owned); }
    },
    notify: {
      schedule: function (n) { rec('schedule', n); return Promise.resolve(true); },
      cancel: function (id) { rec('cancel', id); return Promise.resolve(); }
    },
    haptic: function (k) { rec('haptic', k); return true; },
    store: {
      put: function (k, j) { rec('put', { k: k, j: j }); },
      // what the real shell does when localStorage was purged: write the native copy back, resolve it
      hydrate: function (k) {
        rec('hydrate', k);
        return new Promise(function (res) { setTimeout(function () { localStorage.setItem(k, BOOT_SAVE); res(BOOT_SAVE); }, 30); });
      }
    },
    gc: { submitScore: function (b, n) { rec('submitScore', { b: b, n: n }); return Promise.resolve({ ok: true }); } }
  };

  addEventListener('load', function () {
    setTimeout(run, 300);
  });

  function run() {
    var ok = 0, bad = [];
    function T(name, c) { if (c) ok++; else bad.push(name); }
    var has = function (n) { return calls.some(function (c) { return c.name === n; }); };
    var last = function (n) { var a = calls.filter(function (c) { return c.name === n; }); return a.length ? a[a.length - 1].args : undefined; };
    var toasts = function () { return JSON.stringify(_toastQ) + ($('toast') ? $('toast').textContent : ''); };
    try {
      sfx = function () {}; tone = function () {};
      // ---- boot
      T('boot: hydrate asked for the save key', last('hydrate') === 'theFortSave');
      T('boot: the native copy replaced the fresh save (then ran the usual save migrations)', (S.runs | 0) === 20 && S.gems >= 77 && S.tkills === 3000 && careerBest() >= 33 &&
        localStorage.getItem('theFortSave').indexOf('"tkills":3000') > 0);
      var cfg = last('configure') || {};
      T('boot: configure after hydrate', calls.findIndex(function (c) { return c.name === 'configure'; }) > calls.findIndex(function (c) { return c.name === 'hydrate'; }));
      T('boot: a non-release build gets Google\'s test units', cfg.rewarded === PLAT_IDS.testRewarded && cfg.interstitial === PLAT_IDS.testInterstitial &&
        cfg.rewarded.indexOf('ca-app-pub-3940256099942544/') === 0);
      T('boot: configure gets the RevenueCat key', cfg.rcKey === PLAT_IDS.rcKey && cfg.rcKey.indexOf('appl_') === 0);
      T('boot: configure gets the fort_ products', JSON.stringify(cfg.products) === JSON.stringify(['fort_gems_80', 'fort_gems_500', 'fort_gems_1200', 'fort_gems_2600', 'fort_gems_7000', 'fort_starter', 'fort_noads']));
      T('boot: non-consumables = starter + noads', JSON.stringify(cfg.nonConsumables) === '["fort_starter","fort_noads"]');
      T('boot: owned purchases rehydrated quietly', has('owned') && S.shop.noAds === 1 && !has('restore'));
      T('boot: splash lifted once, after configure', calls.filter(function (c) { return c.name === 'ready'; }).length === 1 &&
        calls.findIndex(function (c) { return c.name === 'ready'; }) > calls.findIndex(function (c) { return c.name === 'configure'; }));
      T('boot: second boot() is a no-op', (Plat.boot(), calls.filter(function (c) { return c.name === 'hydrate'; }).length === 1));

      // ---- save seam
      calls.length = 0; S.bank = 12345; save();
      var put = last('put');
      T('seam: save() mirrors through Shell.store.put', put && put.k === 'theFortSave' && put.j === localStorage.getItem('theFortSave') && put.j.indexOf('"bank":12345') > 0);

      // ---- ads and dev flag
      S.set.dev = true;
      T('ads: on in the app', Plat.adsOn() && Plat.native());
      T('ads: dev flag ignored in the app', Plat.dev() === false);
      S.set.dev = false;
    } catch (e) { bad.push('sync threw: ' + e.message); }

    var chain = Promise.resolve();
    function step(f) { chain = chain.then(f).catch(function (e) { bad.push('threw: ' + e.message); }); }
    step(function () { return Plat.ad('x2').then(function (v) { T('ads: rewarded true', v === true && has('showRewarded')); }); });
    step(function () { next.rewarded = { rewarded: false }; return Plat.ad('x2').then(function (v) { T('ads: closed early = false', v === false); }); });
    step(function () { next.rewarded = { rewarded: false, reason: 'nofill' }; _toastQ.length = 0;
      return Plat.ad('x2').then(function (v) { T('ads: no fill = false + toast', v === false && /No ad available/.test(toasts())); }); });
    step(function () { return Plat.interstitial().then(function (v) { T('ads: interstitial shown', v === true && has('showInterstitial')); }); });
    step(function () { next.shown = { shown: false, reason: 'nofill' }; return Plat.interstitial().then(function (v) { T('ads: interstitial no fill = false', v === false); }); });
    // ---- store
    step(function () { var g0 = S.gems; return shopBuy('fort_gems_500').then(function (v) {
      T('store: gem pack granted on ok', v === true && S.gems === g0 + 500 && last('purchase') === 'fort_gems_500'); }); });
    step(function () { var g0 = S.gems; next.purchase = { ok: false, cancelled: true }; _toastQ.length = 0;
      return shopBuy('fort_gems_80').then(function (v) { T('store: cancel = nothing, no toast', v === false && S.gems === g0 && !/Purchase failed/.test(toasts())); }); });
    step(function () { var g0 = S.gems; next.purchase = { ok: false, error: 'The App Store is unavailable.' }; _toastQ.length = 0;
      return shopBuy('fort_gems_80').then(function (v) { T('store: error = nothing + toast', v === false && S.gems === g0 && /Purchase failed/.test(toasts())); }); });
    step(function () { var g0 = S.gems; S.shop.starter = 0; S.shop.voucher = 0; next.purchase = { ok: true };
      return shopRestore().then(function (n) { T('store: restore sets the starter flag + voucher, no gems', n === 1 && S.shop.starter === 1 && S.shop.voucher === 1 && S.gems === g0); }); });
    step(function () { var e = new Error('Restore failed: offline'); next.restore = e;
      return shopRestore().then(function () { T('store: a failed restore rejects', false); }, function (x) { T('store: a failed restore rejects', x === e); }); });
    step(function () { T('store: localized price from the store', Plat.price('fort_noads', 3.99) === '4,49 €' && Plat.price('fort_gems_80', 0.99) === '$0.99'); });
    // ---- device
    step(function () {
      var at = Date.now() + 3600e3; Plat.notify(at, 'Research complete', 'Rifle II is ready.', 'lab:dmg');
      var n = last('schedule');
      T('device: notify -> schedule {id, at, title, body}', n && n.id === 'lab:dmg' && n.at === at && n.title === 'Research complete');
      Plat.cancel('lab:dmg'); T('device: cancel by id', last('cancel') === 'lab:dmg' && !Plat.log.some(function (x) { return x.id === 'lab:dmg'; }));
      Plat.haptic('success'); T('device: haptic', last('haptic') === 'success');
      Plat.score('daily', 12); T('device: no leaderboard id = no score', !has('submitScore'));
      PLAT_IDS.lbDaily = 'fort.daily'; Plat.score('daily', 12);
      var s = last('submitScore'); T('device: score to the daily leaderboard', s && s.b === 'fort.daily' && s.n === 12); PLAT_IDS.lbDaily = '';
    });
    // ---- lifecycle
    step(function () {
      S.set.blurPause = true; startRun(); G.simSpeed = 1; for (var k = 0; k < 30; k++) update(1 / 60);
      calls.length = 0; window.__plat.state(false);
      T('life: background pauses a running battle', running && paused);
      T('life: and saves', has('put'));
      setPause(false); endRun(true);
    });
    // ---- ui
    step(function () {
      syncSettings();
      T('ui: no developer toggle in the app', $('devRow').hidden === true);
      T('ui: build line', !$('verLine').hidden && $('verLine').textContent === 'The Fort for iOS · v1.0.0 · build 7 · test ads');
    });
    step(function () {
      document.title = 'PLAT pass=' + ok + ' fail=' + bad.length + (bad.length ? ' [' + bad.join(' | ') + ']' : '');
    });
  }
})();
