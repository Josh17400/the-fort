/*
 * The Fort native shell: window.Shell, the device side of the game's `Plat` seam (index.html,
 * "PLATFORM (Plat)"). build_www.py injects capacitor.js and this file into <head>, so Shell exists
 * before the game's script runs. The web build never loads it: there, Plat falls back to its
 * web behavior (no ads, no store, localStorage only).
 *
 * Plugins (all pinned in package.json):
 *   AdMob               @capacitor-community/admob        rewarded + interstitial, ATT, UMP consent
 *   Purchases           @revenuecat/purchases-capacitor   the gem shop
 *   LocalNotifications  @capacitor/local-notifications    lab-complete and Daily Ops reminders
 *   Haptics             @capacitor/haptics
 *   Preferences         @capacitor/preferences            the native copy of the save (Shell.store)
 *   App                 @capacitor/app                    background / foreground
 *   SplashScreen        @capacitor/splash-screen          held until the save is hydrated
 *   GameKit             plugins/capacitor-gamekit         Game Center leaderboard (off until an id is set)
 *
 * The ids (ad units, RevenueCat key, SKUs, leaderboards) live in index.html PLAT_IDS and reach the
 * shell through Shell.configure(). Outside Capacitor, or with a plugin missing, nothing throws:
 * ads resolve { rewarded:false } / { shown:false }, iap rejects or resolves { ok:false }, store
 * and notify no-op, gc resolves { ok:false }.
 *
 * Plain ES5, no bundler.
 */
(function () {
  'use strict';

  var TIMING = {
    rewardedWait: 6000,       // showRewarded() waits this long for an ad that is still loading
    interstitialWait: 4000,   // showInterstitial() likewise; a slow one is skipped, not waited on
    showWatchdog: 8000,       // iOS drops show() with no event when there is no root view controller
    rewardedMax: 150000,      // a reward earned but never dismissed still settles
    storeDebounce: 1200,      // native save mirror: coalesce bursts of save() calls
    splashFallback: 8000      // hide the splash even if the game never calls Shell.ready()
  };

  // ---------- environment ----------
  var cap = window.Capacitor;
  var isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  var platform = isNative ? cap.getPlatform() : 'web';

  function regPlugin(name) {
    if (!isNative) return null;
    try {
      // registerPlugin lives in the @capacitor/core runtime (capacitor.js), not the injected bridge.
      var reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || cap.registerPlugin;
      if (reg) return reg(name);
      if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
      console.warn('[shell] no registerPlugin available for ' + name);
    } catch (e) {
      console.warn('[shell] plugin unavailable: ' + name, e);
    }
    return null;
  }
  var AdMob = regPlugin('AdMob');
  var Purchases = regPlugin('Purchases');
  var Notes = regPlugin('LocalNotifications');
  var Haptics = regPlugin('Haptics');
  var Prefs = regPlugin('Preferences');
  var App = regPlugin('App');
  var Splash = regPlugin('SplashScreen');
  var GameKit = platform === 'ios' ? regPlugin('GameKit') : null;

  var cfg = null; // set once by configure()

  // A value with subscribers: on() replays the current value synchronously.
  function feed(label, initial) {
    var cbs = [];
    var f = {
      value: initial,
      emit: function (v) {
        f.value = v;
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i](v); } catch (e) { console.warn('[shell] ' + label + ' callback threw', e); }
        }
      },
      on: function (cb) {
        if (typeof cb !== 'function') return;
        cbs.push(cb);
        try { cb(f.value); } catch (e) { console.warn('[shell] ' + label + ' callback threw', e); }
      }
    };
    return f;
  }

  function listen(plugin, event, cb) {
    try {
      var h = plugin.addListener(event, cb);
      if (h && typeof h.then === 'function') h.then(null, function (e) { console.warn('[shell] listener ' + event, e); });
    } catch (e) {
      console.warn('[shell] listener ' + event + ' failed', e);
    }
  }

  // ---------- diagnostic log ----------
  // A TestFlight build has no console: ad, store and save events also land here (Shell.log()).
  var events = [];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function log(msg) {
    var d = new Date();
    events.push(pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + ' ' + msg);
    if (events.length > 40) events.shift();
  }
  // Plugin errors arrive as { code, message }, Errors or plain strings.
  function errText(e) {
    if (!e) return 'no detail';
    var msg = typeof e === 'string' ? e : e.message;
    if (!msg) { try { msg = JSON.stringify(e); } catch (x) { msg = String(e); } }
    return (e.code !== undefined && e.code !== null ? 'code ' + e.code + ' ' : '') + String(msg).slice(0, 160);
  }

  // ---------- app lifecycle ----------
  // `pause`/`visibilitychange` alone are not enough in WKWebView: appStateChange fires first and
  // reliably, and the store flushes on it while the app still has time to run.
  var appActive = feed('app.onState', true);
  if (App) {
    listen(App, 'appStateChange', function (s) {
      var active = !(s && s.isActive === false);
      if (!active) storeFlush();
      appActive.emit(active);
    });
  }

  // ---------- splash ----------
  var splashDone = false;
  function ready() {
    if (splashDone) return;
    splashDone = true;
    if (!Splash) return;
    try { Splash.hide({ fadeOutDuration: 250 }).catch(function () {}); } catch (e) { /* no splash plugin */ }
  }
  if (Splash) setTimeout(ready, TIMING.splashFallback);

  // ---------- store: the native copy of the save ----------
  // iOS may purge a WKWebView's localStorage (low storage, long disuse). Every save the game
  // writes to localStorage is mirrored to Capacitor Preferences (UserDefaults) as
  // "<seq>\n<json>"; the sequence number also sits in localStorage under "<key>.seq".
  // hydrate(key) at boot compares the two: the native copy wins when localStorage held no save
  // when this page loaded (purged) or holds an older one (lower sequence), and is written back to
  // localStorage; otherwise localStorage is mirrored out. Until hydrate() settles for a key, put()
  // never writes native, so the fresh save a game makes on an empty localStorage can't overwrite
  // the real one.
  var store = {};  // key -> { hydrated, pending: { n, d } | null }
  var storeTimer = null;
  var bootKeys = {}; // the localStorage keys that existed before the game's first write
  try {
    for (var bk = 0; bk < window.localStorage.length; bk++) bootKeys[window.localStorage.key(bk)] = true;
  } catch (e) { /* storage blocked: every key reads as absent */ }

  function slot(key) {
    return store[key] || (store[key] = { hydrated: false, pending: null });
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function seqOf(key) { var n = parseInt(lsGet(key + '.seq'), 10); return isFinite(n) && n > 0 ? n : 0; }

  function storeWrite(key) {
    var s = store[key];
    if (!Prefs || !s || !s.hydrated || !s.pending) return;
    var p = s.pending;
    s.pending = null;
    Prefs.set({ key: key, value: p.n + '\n' + p.d }).catch(function (e) {
      log('save mirror failed: ' + errText(e));
      if (!s.pending) s.pending = p; // retried by the next put() or flush
    });
  }

  function storeFlush() {
    clearTimeout(storeTimer);
    storeTimer = null;
    for (var k in store) if (Object.prototype.hasOwnProperty.call(store, k)) storeWrite(k);
  }

  function storePut(key, json) {
    if (typeof key !== 'string' || typeof json !== 'string') return;
    var n = seqOf(key) + 1;
    lsSet(key + '.seq', String(n));
    var s = slot(key);
    s.pending = { n: n, d: json };
    if (!Prefs || !s.hydrated) return;
    // Backgrounding: write now, the app may be suspended before a timer fires.
    if (document.visibilityState === 'hidden' || !appActive.value) { storeFlush(); return; }
    if (!storeTimer) storeTimer = setTimeout(storeFlush, TIMING.storeDebounce);
  }

  // Resolves the save JSON when the native copy replaced localStorage, else null. Never rejects.
  function storeHydrate(key) {
    var s = slot(key);
    if (!Prefs) { s.hydrated = true; return Promise.resolve(null); }
    return Promise.resolve()
      .then(function () { return Prefs.get({ key: key }); })
      .then(function (r) {
        var raw = r && typeof r.value === 'string' ? r.value : '';
        var cut = raw.indexOf('\n');
        var nn = cut > 0 ? parseInt(raw.slice(0, cut), 10) : 0;
        var nd = cut > 0 ? raw.slice(cut + 1) : '';
        var local = lsGet(key);
        var ln = seqOf(key);
        var purged = !bootKeys[key];
        s.hydrated = true;
        if (nd && nn > 0 && (purged || local === null || nn > ln)) {
          lsSet(key, nd);
          lsSet(key + '.seq', String(nn));
          s.pending = null; // anything written since boot on an empty localStorage was a fresh save
          log('save restored from native copy (seq ' + nn + ', local ' + (purged ? 'empty at boot' : 'seq ' + ln) + ')');
          return nd;
        }
        if (local !== null && (ln !== nn || !nd)) s.pending = { n: ln || 1, d: local };
        storeFlush();
        return null;
      })
      .catch(function (e) {
        s.hydrated = true;
        log('save hydrate failed: ' + errText(e));
        storeFlush();
        return null;
      });
  }

  if (isNative) {
    window.addEventListener('pagehide', storeFlush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') storeFlush();
    });
  }

  // ---------- ads ----------
  // ATT runs at launch, where App Review looks for it (a 2.1 rejection otherwise). A request made
  // before the app is fully active completes with no sheet and leaves 'notDetermined', so the
  // status is re-checked and the request retried with backoff and on re-foreground. Never rejects.
  var attPromise = null;
  var attStatus = platform === 'ios' ? 'unknown' : 'n/a';
  function ensureAtt() {
    if (attPromise) return attPromise;
    if (!AdMob || platform !== 'ios') { attPromise = Promise.resolve(); return attPromise; }
    attPromise = new Promise(function (resolve) {
      var attempts = 0;
      var settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        document.removeEventListener('visibilitychange', onVis);
        resolve();
      }
      function retry() {
        attempts++;
        if (attempts >= 6) return finish();
        setTimeout(attempt, 500 * attempts);
      }
      function attempt() {
        if (settled) return;
        if (document.visibilityState === 'hidden') return retry();
        AdMob.trackingAuthorizationStatus()
          .then(function (t) {
            if (t && t.status) attStatus = t.status;
            if (!t || t.status !== 'notDetermined') return finish();
            return AdMob.requestTrackingAuthorization()
              .catch(function () {})
              .then(function () { return AdMob.trackingAuthorizationStatus(); })
              .then(function (t2) {
                if (t2 && t2.status) attStatus = t2.status;
                if (t2 && t2.status === 'notDetermined') return retry();
                finish();
              });
          })
          .catch(finish);
      }
      function onVis() {
        if (!settled && document.visibilityState === 'visible') attempt();
      }
      document.addEventListener('visibilitychange', onVis);
      attempt();
    });
    return attPromise;
  }

  // Resolves the npa flag (true = non-personalized): personalized only with ATT authorized (or
  // not applicable) AND UMP consent obtained or not required. Never rejects.
  var adsInitPromise = null;
  function ensureAdsInit() {
    if (adsInitPromise) return adsInitPromise;
    adsInitPromise = ensureAtt()
      .then(function () { return AdMob.initialize({}); })
      .then(function () { return AdMob.requestConsentInfo({}); })
      .then(function (info) {
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') return AdMob.showConsentForm();
        return info;
      })
      .then(function (info) {
        var status = info && info.status;
        var consentOk = status === 'OBTAINED' || status === 'NOT_REQUIRED';
        var attOk = attStatus === 'authorized' || attStatus === 'n/a';
        var npa = !(consentOk && attOk);
        log('ads init: npa ' + npa + ' · ATT ' + attStatus + ' · consent ' + (status || 'none'));
        return npa;
      })
      .catch(function (e) {
        log('ads init failed, npa true · ATT ' + attStatus + ' · ' + errText(e));
        return true;
      });
    return adsInitPromise;
  }

  // One full-screen format (rewarded or interstitial) and its load state. The plugin keeps one
  // ad per format and never clears a shown one, so each show is followed by a fresh prepare.
  function adFormat(o) {
    var f = {
      name: o.name,
      ready: feed(o.name + '.onReady', false),
      loading: false,
      retryTimer: null,
      retryIdx: 0,
      settle: null,     // set while a show is in flight
      watchdog: null,
      waiters: []       // resolvers waiting on a load
    };

    function wake(ok) {
      var w = f.waiters;
      f.waiters = [];
      for (var i = 0; i < w.length; i++) w[i](ok);
    }

    f.preload = function () {
      if (!AdMob || !cfg || !cfg[o.name] || f.loading || f.ready.value) return;
      f.loading = true;
      if (f.retryTimer) { clearTimeout(f.retryTimer); f.retryTimer = null; }
      ensureAdsInit()
        .then(function (npa) {
          log(o.name + ' prepare (npa ' + npa + ')');
          return AdMob[o.prepare]({ adId: cfg[o.name], npa: npa });
        })
        .catch(function (e) { log(o.name + ' prepare failed: ' + errText(e)); })
        .then(function () { f.loading = false; if (!f.ready.value) wake(false); });
    };

    f.retry = function () {
      if (f.retryTimer) return;
      var delay = Math.min(30000 * Math.pow(2, f.retryIdx++), 300000);
      log(o.name + ' retry in ' + delay / 1000 + ' s');
      f.retryTimer = setTimeout(function () { f.retryTimer = null; f.preload(); }, delay);
    };

    // Resolves true once an ad is loaded, false after `ms` or a failed load.
    f.waitReady = function (ms) {
      if (f.ready.value) return Promise.resolve(true);
      if (!f.loading) {
        if (f.retryTimer) { clearTimeout(f.retryTimer); f.retryTimer = null; }
        f.preload();
      }
      return new Promise(function (resolve) {
        var done = false;
        function fin(ok) { if (!done) { done = true; resolve(ok); } }
        f.waiters.push(fin);
        setTimeout(function () { fin(f.ready.value); }, ms);
      });
    };

    f.finish = function (result) {
      if (f.watchdog) { clearTimeout(f.watchdog); f.watchdog = null; }
      var s = f.settle;
      f.settle = null;
      if (s) s(result);
    };

    f.bind = function () {
      listen(AdMob, o.events.loaded, function () {
        log(o.name + ' loaded');
        f.retryIdx = 0;
        f.ready.emit(true);
        wake(true);
      });
      listen(AdMob, o.events.failedToLoad, function (e) {
        log(o.name + ' failed to load: ' + errText(e));
        f.ready.emit(false);
        wake(false);
        f.retry();
      });
      listen(AdMob, o.events.showed, function () {
        log(o.name + ' showed');
        if (f.watchdog) { clearTimeout(f.watchdog); f.watchdog = null; }
      });
      listen(AdMob, o.events.failedToShow, function (e) {
        log(o.name + ' failed to show: ' + errText(e));
        f.onFailedToShow();
        f.preload();
      });
      listen(AdMob, o.events.dismissed, function () {
        log(o.name + ' dismissed');
        f.onDismissed();
        f.preload();
      });
    };

    // Presents the loaded ad; resolves through f.finish() (the format's dismiss / fail handlers).
    f.present = function () {
      f.ready.emit(false); // also blocks a double-tap re-entry
      return new Promise(function (resolve) {
        f.settle = resolve;
        f.watchdog = setTimeout(function () {
          f.watchdog = null;
          log(o.name + ' never reached the screen (' + TIMING.showWatchdog / 1000 + ' s watchdog)');
          f.onFailedToShow();
          f.preload();
        }, TIMING.showWatchdog);
        AdMob[o.show]().catch(function (e) {
          log(o.name + ' show rejected: ' + errText(e));
          f.onFailedToShow();
          f.preload();
        });
      });
    };
    return f;
  }

  // Rewarded: the reward flag comes from onRewardedVideoAdReward (showRewardVideoAd() also
  // resolves on it), and the call settles on dismissal so the game never resumes under the ad.
  var rewarded = adFormat({
    name: 'rewarded',
    prepare: 'prepareRewardVideoAd',
    show: 'showRewardVideoAd',
    events: {
      loaded: 'onRewardedVideoAdLoaded', failedToLoad: 'onRewardedVideoAdFailedToLoad',
      showed: 'onRewardedVideoAdShowed', failedToShow: 'onRewardedVideoAdFailedToShow',
      dismissed: 'onRewardedVideoAdDismissed'
    }
  });
  var rewardEarned = false;
  var rewardMaxTimer = null;
  function rewardDone(reason) {
    clearTimeout(rewardMaxTimer);
    rewarded.finish(reason ? { rewarded: rewardEarned, reason: reason } : { rewarded: rewardEarned });
  }
  rewarded.onDismissed = function () { rewardDone(); };
  rewarded.onFailedToShow = function () { rewardEarned = false; rewardDone('failed'); };

  function showRewarded() {
    if (!AdMob || !cfg || !cfg.rewarded) return Promise.resolve({ rewarded: false, reason: 'unavailable' });
    if (rewarded.settle) return Promise.resolve({ rewarded: false, reason: 'busy' });
    return rewarded.waitReady(TIMING.rewardedWait).then(function (ok) {
      if (!ok) { log('rewarded show skipped: no ad loaded'); return { rewarded: false, reason: 'nofill' }; }
      log('rewarded show');
      rewardEarned = false;
      return rewarded.present();
    });
  }

  var interstitial = adFormat({
    name: 'interstitial',
    prepare: 'prepareInterstitial',
    show: 'showInterstitial',
    events: {
      loaded: 'interstitialAdLoaded', failedToLoad: 'interstitialAdFailedToLoad',
      showed: 'interstitialAdShowed', failedToShow: 'interstitialAdFailedToShow',
      dismissed: 'interstitialAdDismissed'
    }
  });
  interstitial.onDismissed = function () { interstitial.finish({ shown: true }); };
  interstitial.onFailedToShow = function () { interstitial.finish({ shown: false, reason: 'failed' }); };

  function showInterstitial() {
    if (!AdMob || !cfg || !cfg.interstitial) return Promise.resolve({ shown: false, reason: 'unavailable' });
    if (interstitial.settle || rewarded.settle) return Promise.resolve({ shown: false, reason: 'busy' });
    return interstitial.waitReady(TIMING.interstitialWait).then(function (ok) {
      if (!ok) { log('interstitial show skipped: no ad loaded'); return { shown: false, reason: 'nofill' }; }
      log('interstitial show');
      return interstitial.present();
    });
  }

  if (AdMob) {
    rewarded.bind();
    interstitial.bind();
    listen(AdMob, 'onRewardedVideoAdReward', function () {
      log('rewarded reward earned');
      rewardEarned = true;
      // Settles even if the dismissal never arrives.
      clearTimeout(rewardMaxTimer);
      rewardMaxTimer = setTimeout(function () { rewardDone(); }, TIMING.rewardedMax);
    });
  }

  // ---------- iap ----------
  var iapConfigPromise = null;
  var productCache = {}; // id -> the full store product, which purchaseStoreProduct needs

  function iapOn() { return !!(Purchases && cfg && cfg.rcKey); }

  function iapUnavailable() {
    return new Error('Purchases unavailable' + (isNative ? (cfg && cfg.rcKey ? '' : ': no RevenueCat key') : ' in browser'));
  }

  function errMsg(e) { return (e && e.message) || String(e); }

  // RevenueCat reports a cancelled purchase or sign-in sheet as code 1.
  function isCancelled(e) {
    return !!e && (String(e.code) === '1' || e.userCancelled === true || /cancel/i.test(errMsg(e)));
  }

  function ensureIapConfigured() {
    if (!iapOn()) return Promise.reject(iapUnavailable());
    if (iapConfigPromise) return iapConfigPromise;
    iapConfigPromise = Purchases.configure({ apiKey: cfg.rcKey }).catch(function (e) {
      iapConfigPromise = null;
      log('iap configure failed: ' + errText(e));
      throw e;
    });
    return iapConfigPromise;
  }

  function fetchProducts(ids) {
    return ensureIapConfigured().then(function () {
      return Purchases.getProducts({ productIdentifiers: ids, type: 'NON_SUBSCRIPTION' });
    }).then(function (res) {
      var products = (res && res.products) || [];
      for (var i = 0; i < products.length; i++) productCache[products[i].identifier] = products[i];
      return products;
    });
  }

  function iapGetProducts(ids) {
    return fetchProducts(ids).then(function (products) {
      return products.map(function (p) { return { id: p.identifier, price: p.priceString, title: p.title }; });
    });
  }

  // The store's localized price once products are loaded, else null.
  function iapPrice(id) {
    var p = productCache[id];
    return p && p.priceString ? p.priceString : null;
  }

  // Never rejects: { ok:true } | { ok:false, cancelled:true } | { ok:false, error }.
  function iapPurchase(id) {
    return Promise.resolve()
      .then(function () {
        if (productCache[id]) return productCache[id];
        return fetchProducts([id]).then(function () { return productCache[id]; });
      })
      .then(function (product) {
        if (!product) throw new Error('not in the App Store yet (' + id + ')');
        return Purchases.purchaseStoreProduct({ product: product });
      })
      .then(function () {
        log('purchase ok: ' + id);
        return { ok: true };
      }, function (e) {
        e = e || {};
        if (isCancelled(e)) { log('purchase cancelled: ' + id); return { ok: false, cancelled: true }; }
        log('purchase failed: ' + id + ' · ' + errText(e));
        return { ok: false, error: errMsg(e) };
      });
  }

  // The configured non-consumables in a CustomerInfo. RevenueCat fills its three fields on
  // different paths and any one can lag, so all three count. Consumables never do.
  function ownedIds(info) {
    info = info || {};
    var want = (cfg && cfg.nonConsumables) || [];
    var found = {};
    function add(id) {
      if (typeof id !== 'string' || !id) return;
      id = id.split(':')[0]; // some stores append ':<base plan>'
      if (want.indexOf(id) >= 0) found[id] = true;
    }
    var all = info.allPurchasedProductIdentifiers || [];
    for (var i = 0; i < all.length; i++) add(all[i]);
    var txs = info.nonSubscriptionTransactions || [];
    for (var j = 0; j < txs.length; j++) add(txs[j] && txs[j].productIdentifier);
    var ents = (info.entitlements && info.entitlements.all) || {};
    for (var k in ents) if (Object.prototype.hasOwnProperty.call(ents, k) && ents[k]) add(ents[k].productIdentifier);
    return want.filter(function (id) { return found[id]; });
  }

  // Rejects with an Error the game can show; err.cancelled marks a dismissed sign-in sheet.
  function iapRestore() {
    return ensureIapConfigured()
      .then(function () {
        return Purchases.restorePurchases().then(
          function (res) { return { info: res && res.customerInfo }; },
          function (restoreErr) {
            // syncPurchases posts the local receipt without a sign-in prompt: a silent rescue
            // for a dismissed sheet or a flaky receipt refresh.
            return Purchases.syncPurchases()
              .then(function () { return Purchases.getCustomerInfo(); })
              .then(function (res) { return { info: res && res.customerInfo, rescueOf: restoreErr }; },
                function () { throw restoreErr; });
          });
      })
      .then(function (r) {
        var owned = ownedIds(r.info);
        // An empty rescue proves nothing: report the restore failure, not "nothing to restore".
        if (r.rescueOf && !owned.length) throw r.rescueOf;
        log('restore: ' + (owned.join(', ') || 'nothing owned'));
        return owned;
      })
      .catch(function (e) {
        if (e instanceof Error && e.cancelled !== undefined) throw e;
        var err = new Error(isCancelled(e)
          ? 'Restore cancelled. Approve the App Store sign-in to restore purchases.'
          : 'Restore failed: ' + errMsg(e));
        err.cancelled = isCancelled(e);
        log(err.message);
        throw err;
      });
  }

  // Cached CustomerInfo, no store round trip and no sign-in sheet: for launch-time rehydration.
  function iapOwned() {
    return ensureIapConfigured()
      .then(function () { return Purchases.getCustomerInfo(); })
      .then(function (res) { return ownedIds(res && res.customerInfo); });
  }

  // ---------- local notifications ----------
  var notePerm = null; // null = not asked yet this launch, else a promise of the grant

  // Stable string id -> the plugin's positive 32-bit int id: scheduling the same id replaces it.
  function noteId(s) {
    var h = 7;
    s = String(s);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000000 + 1;
  }

  function notePermission() {
    if (notePerm) return notePerm;
    // After the launch ATT prompt settles, so the two system sheets never stack.
    notePerm = (attPromise || Promise.resolve())
      .then(function () { return Notes.checkPermissions(); })
      .then(function (p) {
        if (p && p.display === 'granted') return true;
        if (p && p.display === 'denied') return false;
        return Notes.requestPermissions().then(function (r) { return !!r && r.display === 'granted'; });
      })
      .catch(function (e) { log('notification permission failed: ' + errText(e)); notePerm = null; return false; });
    return notePerm;
  }

  // Resolves true once scheduled. `at` is wall-clock ms and must be in the future.
  function noteSchedule(n) {
    if (!Notes || !n || !(n.at > Date.now())) return Promise.resolve(false);
    var id = noteId(n.id);
    return notePermission()
      .then(function (ok) {
        if (!ok) return false;
        return Notes.cancel({ notifications: [{ id: id }] }).catch(function () {})
          .then(function () {
            return Notes.schedule({ notifications: [{ id: id, title: String(n.title || ''), body: String(n.body || ''), schedule: { at: new Date(n.at), allowWhileIdle: true } }] });
          })
          .then(function () { return true; });
      })
      .catch(function (e) { log('notification schedule failed: ' + errText(e)); return false; });
  }

  function noteCancel(id) {
    if (!Notes) return Promise.resolve();
    return Notes.cancel({ notifications: [{ id: noteId(id) }] }).catch(function () {});
  }

  // ---------- haptics ----------
  var IMPACT = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
  var NOTE = { success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' };
  function haptic(kind) {
    if (!Haptics) return false;
    try {
      var p = NOTE[kind] ? Haptics.notification({ type: NOTE[kind] }) : Haptics.impact({ style: IMPACT[kind] || 'LIGHT' });
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Game Center ----------
  // Off until configure() gets a leaderboard id: no sign-in, no "Welcome back" banner.
  var gcSignInPromise = null;
  function gcSignIn() {
    if (gcSignInPromise) return gcSignInPromise;
    if (!GameKit) { gcSignInPromise = Promise.resolve(null); return gcSignInPromise; }
    gcSignInPromise = Promise.resolve()
      .then(function () { return GameKit.signIn(); })
      .then(function (p) { return p && p.playerId ? p : null; }, function (e) {
        log('game center: not signed in · ' + errText(e));
        return null;
      });
    return gcSignInPromise;
  }

  function gcSubmitScore(board, score) {
    if (!GameKit || !board || !cfg || (cfg.leaderboards || []).indexOf(board) < 0) return Promise.resolve({ ok: false });
    return gcSignIn()
      .then(function (player) {
        if (!player) return { ok: false };
        return GameKit.submitScore({ leaderboardId: board, score: Math.max(0, Math.round(+score) || 0) })
          .then(function () { return { ok: true }; });
      })
      .catch(function (e) { log('game center submit failed: ' + errText(e)); return { ok: false }; });
  }

  // ---------- configure ----------
  // Called once by the game's Plat.boot() with PLAT_IDS: starts ATT, consent, ad preloads,
  // RevenueCat and Game Center. Repeat calls are ignored.
  function configure(c) {
    if (cfg || !c) return;
    cfg = {
      rewarded: c.rewarded || '',
      interstitial: c.interstitial || '',
      rcKey: c.rcKey || '',
      products: (c.products || []).slice(),
      nonConsumables: (c.nonConsumables || []).slice(),
      leaderboards: (c.leaderboards || []).filter(Boolean)
    };
    if (!isNative) return;
    var adsUp = Promise.resolve();
    if (AdMob) {
      adsUp = ensureAdsInit();
      rewarded.preload();
      if (c.preloadInterstitial) interstitial.preload();
    } else {
      log('AdMob plugin unavailable');
    }
    if (iapOn()) fetchProducts(cfg.products).catch(function (e) { log('products failed: ' + errText(e)); });
    // After ATT and consent: GameKit's sheet and those prompts share the root view controller.
    if (cfg.leaderboards.length) adsUp.then(gcSignIn);
  }

  // ---------- contract ----------
  window.Shell = {
    native: isNative,
    platform: platform,
    build: String(window.FORT_BUILD || ''),     // stamped by build_www.py: the TestFlight build number
    version: String(window.FORT_VERSION || ''), // and MARKETING_VERSION from the Xcode project
    liveAds: window.FORT_ADS === 'live',         // build_www.py --release: live AdMob units, else Google's test units
    configure: configure,
    ready: ready,
    log: function () { return events.slice(); },
    app: { onState: appActive.on, active: function () { return appActive.value; } },
    ads: {
      available: function () { return !!AdMob; },
      rewardedReady: function () { return rewarded.ready.value; },
      onRewardedReady: rewarded.ready.on,
      showRewarded: showRewarded,
      preloadInterstitial: function () { interstitial.preload(); },
      showInterstitial: showInterstitial
    },
    iap: {
      available: iapOn,
      getProducts: iapGetProducts,
      price: iapPrice,
      purchase: iapPurchase,
      restore: iapRestore,
      owned: iapOwned
    },
    notify: { schedule: noteSchedule, cancel: noteCancel, id: noteId },
    haptic: haptic,
    store: { put: storePut, hydrate: storeHydrate, flush: storeFlush },
    gc: { submitScore: gcSubmitScore }
  };
})();
