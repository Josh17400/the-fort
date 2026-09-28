// window.Shell (native/shell.js) against mocked Capacitor plugins, in plain Node: no device, no browser.
// Each scenario loads the REAL shell.js into a fresh vm context with a fake window, document,
// localStorage, a fake clock (timers only run when the test advances it) and scripted plugins whose
// method names, argument shapes and event names are the ones in the pinned plugins' type definitions
// (node_modules/@capacitor-community/admob, @revenuecat/purchases-capacitor, @capacitor/*).
//
//   web        outside Capacitor every call degrades, nothing throws
//   att        ATT runs at launch before AdMob.initialize; npa follows ATT + UMP consent
//   rewarded   preload, reward then dismiss, dismiss without reward, show rejected, never shown
//              (watchdog), no fill, reload after each show
//   inter      interstitial preload / show / skipped while loading too long
//   iap        configure, products + localized price, purchase ok / cancelled / failed, owned and
//              restore filtering, restore rescue through syncPurchases, no key = no store
//   notify     permission asked once, int id from the string id, reschedule replaces, cancel
//   haptic     kind -> Haptics call
//   store      save mirror: nothing written before hydrate, purged localStorage restored, newer
//              native copy wins, newer local copy mirrored out, debounce, flush on background
//   gc         Game Center stays off without a leaderboard id; with one: sign-in, submitScore
//   splash     ready() hides once; the fallback timer hides it if the game never does; build stamp and ad mode
//
// Run:  node native/test_shell.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SHELL_SRC = fs.readFileSync(path.join(__dirname, 'shell.js'), 'utf8');

let pass = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else failures.push(name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail)));
}
const flush = () => new Promise((r) => setImmediate(r));
async function settle(n = 6) { for (let i = 0; i < n; i++) await flush(); }

// ---------------------------------------------------------------- the fake device
function makeEnv(opts = {}) {
  const calls = [];
  const rec = (name, args) => calls.push(args === undefined ? { name } : { name, args });
  const listeners = {};
  const on = (plugin) => (event, cb) => {
    (listeners[plugin + ':' + event] = listeners[plugin + ':' + event] || []).push(cb);
    return Promise.resolve({ remove: () => {} });
  };
  const emit = (plugin, event, data) => (listeners[plugin + ':' + event] || []).forEach((cb) => cb(data));

  // clock
  let now = 0;
  let timerSeq = 0;
  const timers = new Map();
  const setTimeoutF = (fn, ms) => { const id = ++timerSeq; timers.set(id, { fn, at: now + (ms || 0) }); return id; };
  const clearTimeoutF = (id) => { timers.delete(id); };
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      await settle();
      let next = null;
      for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
    await settle();
  }

  // storage
  const ls = new Map(Object.entries(opts.localStorage || {}));
  const localStorage = {
    get length() { return ls.size; },
    key: (i) => [...ls.keys()][i] ?? null,
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => { ls.set(k, String(v)); },
    removeItem: (k) => { ls.delete(k); }
  };
  const prefs = new Map(Object.entries(opts.prefs || {}));

  // document
  const docListeners = {};
  const document = {
    visibilityState: 'visible',
    addEventListener: (e, cb) => { (docListeners[e] = docListeners[e] || []).push(cb); },
    removeEventListener: (e, cb) => { docListeners[e] = (docListeners[e] || []).filter((f) => f !== cb); }
  };
  const winListeners = {};

  const plugins = {};
  const native = opts.native !== false;
  const P = opts.plugins || {};

  if (P.AdMob !== false) {
    const ad = Object.assign({
      att: 'notDetermined', attAfterRequest: 'authorized', consent: 'NOT_REQUIRED',
      rewardedLoad: 'ok', rewardedShow: 'reward', interLoad: 'ok', interShow: 'ok', loadDelay: 10
    }, P.AdMob || {});
    plugins.AdMob = {
      trackingAuthorizationStatus: () => { rec('att.status'); return Promise.resolve({ status: ad.att }); },
      requestTrackingAuthorization: () => { rec('att.request'); ad.att = ad.attAfterRequest; return Promise.resolve(); },
      initialize: (o) => { rec('initialize', o); return Promise.resolve(); },
      requestConsentInfo: (o) => { rec('requestConsentInfo', o); return Promise.resolve({ status: ad.consent, isConsentFormAvailable: false, canRequestAds: true }); },
      showConsentForm: () => { rec('showConsentForm'); return Promise.resolve({ status: 'OBTAINED' }); },
      addListener: on('AdMob'),
      prepareRewardVideoAd: (o) => {
        rec('prepareRewardVideoAd', o);
        const mode = typeof ad.rewardedLoad === 'function' ? ad.rewardedLoad() : ad.rewardedLoad;
        return new Promise((res, rej) => setTimeoutF(() => {
          if (mode === 'ok') { emit('AdMob', 'onRewardedVideoAdLoaded', { adUnitId: o.adId }); res({ adUnitId: o.adId }); }
          else if (mode === 'fail') { emit('AdMob', 'onRewardedVideoAdFailedToLoad', { code: 3, message: 'No fill' }); rej(new Error('Loading failed')); }
          // 'hang': never loads
        }, ad.loadDelay));
      },
      showRewardVideoAd: () => {
        rec('showRewardVideoAd');
        const mode = ad.rewardedShow;
        if (mode === 'reject') return Promise.reject(new Error('Reward Video is Not Ready Yet'));
        if (mode === 'silent') return new Promise(() => {}); // no root view controller: nothing ever happens
        return new Promise((res) => {
          setTimeoutF(() => emit('AdMob', 'onRewardedVideoAdShowed', {}), 5);
          if (mode === 'failShow') { setTimeoutF(() => emit('AdMob', 'onRewardedVideoAdFailedToShow', { code: 0, message: 'boom' }), 6); return; }
          if (mode === 'reward' || mode === 'noDismiss') setTimeoutF(() => { emit('AdMob', 'onRewardedVideoAdReward', { type: 'coins', amount: 1 }); res({ type: 'coins', amount: 1 }); }, 1000);
          if (mode !== 'noDismiss') setTimeoutF(() => emit('AdMob', 'onRewardedVideoAdDismissed', {}), 2000);
        });
      },
      prepareInterstitial: (o) => {
        rec('prepareInterstitial', o);
        return new Promise((res, rej) => setTimeoutF(() => {
          if (ad.interLoad === 'ok') { emit('AdMob', 'interstitialAdLoaded', { adUnitId: o.adId }); res({ adUnitId: o.adId }); }
          else if (ad.interLoad === 'fail') { emit('AdMob', 'interstitialAdFailedToLoad', { code: 3, message: 'No fill' }); rej(new Error('Loading failed')); }
        }, ad.loadDelay));
      },
      showInterstitial: () => {
        rec('showInterstitial');
        setTimeoutF(() => emit('AdMob', 'interstitialAdShowed', {}), 5);
        setTimeoutF(() => emit('AdMob', 'interstitialAdDismissed', {}), 1500);
        return Promise.resolve();
      }
    };
  }

  if (P.Purchases !== false) {
    const pu = Object.assign({ store: ['fort_gems_80', 'fort_gems_500', 'fort_starter', 'fort_noads'], customerInfo: {}, purchase: 'ok', restore: 'ok' }, P.Purchases || {});
    const product = (id) => ({ identifier: id, priceString: '€' + id.length + ',99', title: 'T ' + id });
    plugins.Purchases = {
      configure: (o) => { rec('configure', o); return Promise.resolve(); },
      getProducts: (o) => { rec('getProducts', o); return Promise.resolve({ products: o.productIdentifiers.filter((i) => pu.store.includes(i)).map(product) }); },
      purchaseStoreProduct: (o) => {
        rec('purchaseStoreProduct', o.product.identifier);
        if (pu.purchase === 'cancel') return Promise.reject({ code: '1', message: 'Purchase was cancelled.', userCancelled: true });
        if (pu.purchase === 'error') return Promise.reject({ code: '2', message: 'The App Store is unavailable.' });
        return Promise.resolve({ productIdentifier: o.product.identifier, customerInfo: pu.customerInfo });
      },
      getCustomerInfo: () => { rec('getCustomerInfo'); return Promise.resolve({ customerInfo: pu.customerInfo }); },
      restorePurchases: () => {
        rec('restorePurchases');
        return pu.restore === 'ok' ? Promise.resolve({ customerInfo: pu.customerInfo }) : Promise.reject({ code: '1', message: 'cancelled', userCancelled: true });
      },
      syncPurchases: () => { rec('syncPurchases'); return Promise.resolve(); }
    };
  }

  if (P.LocalNotifications !== false) {
    const ln = Object.assign({ perm: 'prompt', grant: 'granted' }, P.LocalNotifications || {});
    plugins.LocalNotifications = {
      checkPermissions: () => { rec('notes.check'); return Promise.resolve({ display: ln.perm }); },
      requestPermissions: () => { rec('notes.request'); ln.perm = ln.grant; return Promise.resolve({ display: ln.grant }); },
      schedule: (o) => { rec('notes.schedule', o); return Promise.resolve({ notifications: o.notifications.map((n) => ({ id: n.id })) }); },
      cancel: (o) => { rec('notes.cancel', o); return Promise.resolve(); }
    };
  }
  plugins.Haptics = {
    impact: (o) => { rec('impact', o); return Promise.resolve(); },
    notification: (o) => { rec('notification', o); return Promise.resolve(); }
  };
  if (P.Preferences !== false) {
    plugins.Preferences = {
      get: (o) => { rec('prefs.get', o.key); return Promise.resolve({ value: prefs.has(o.key) ? prefs.get(o.key) : null }); },
      set: (o) => { rec('prefs.set', o.key); prefs.set(o.key, o.value); return Promise.resolve(); }
    };
  }
  plugins.App = { addListener: on('App') };
  plugins.SplashScreen = { hide: (o) => { rec('splash.hide', o); return Promise.resolve(); } };
  plugins.GameKit = {
    signIn: () => { rec('gc.signIn'); return Promise.resolve({ playerId: 'G:1', displayName: 'Cmdr' }); },
    submitScore: (o) => { rec('gc.submitScore', o); return Promise.resolve(); }
  };

  const window = {
    localStorage,
    addEventListener: (e, cb) => { (winListeners[e] = winListeners[e] || []).push(cb); },
    console: { log() {}, warn() {}, error() {} }
  };
  if (native) {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} };
    window.capacitorExports = { registerPlugin: (name) => plugins[name] || null };
  }
  if (opts.build) window.FORT_BUILD = opts.build;
  if (opts.ads) window.FORT_ADS = opts.ads;

  const ctx = vm.createContext(Object.assign(window, {
    window, document, setTimeout: setTimeoutF, clearTimeout: clearTimeoutF, Date, Math, JSON, Promise, Object, Array,
    String, Number, Error, parseInt, isFinite, console: window.console
  }));
  ctx.window = ctx;
  vm.runInContext(SHELL_SRC, ctx, { filename: 'shell.js' });

  return {
    Shell: ctx.Shell, calls, ls, prefs, advance, emit, document,
    names: () => calls.map((c) => c.name),
    count: (n) => calls.filter((c) => c.name === n).length,
    args: (n) => calls.filter((c) => c.name === n).map((c) => c.args),
    hide: async () => { document.visibilityState = 'hidden'; (docListeners.visibilitychange || []).forEach((f) => f()); await settle(); },
    pagehide: async () => { (winListeners.pagehide || []).forEach((f) => f()); await settle(); }
  };
}

const CFG = {
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rcKey: 'appl_TEST',
  products: ['fort_gems_80', 'fort_gems_500', 'fort_gems_1200', 'fort_starter', 'fort_noads'],
  nonConsumables: ['fort_starter', 'fort_noads'],
  leaderboards: ['']
};
const cfg = (o) => Object.assign({}, CFG, o || {});

// ---------------------------------------------------------------- scenarios
async function web() {
  const env = makeEnv({ native: false });
  const S = env.Shell;
  S.configure(cfg());
  check('web: not native', S.native === false && S.platform === 'web');
  check('web: no ads', S.ads.available() === false && S.ads.rewardedReady() === false);
  const r = await S.ads.showRewarded();
  check('web: showRewarded degrades', r.rewarded === false && r.reason === 'unavailable', r);
  const i = await S.ads.showInterstitial();
  check('web: showInterstitial degrades', i.shown === false, i);
  check('web: no store', S.iap.available() === false && S.iap.price('fort_noads') === null);
  const buy = await S.iap.purchase('fort_noads');
  check('web: purchase resolves ok:false', buy.ok === false && !!buy.error, buy);
  const rest = await S.iap.restore().then(() => 'resolved', (e) => e.message);
  check('web: restore rejects with a message', /unavailable/i.test(rest), rest);
  check('web: notify schedules nothing', (await S.notify.schedule({ id: 'x', at: Date.now() + 1e6, title: 't', body: 'b' })) === false);
  check('web: haptic is a no-op', S.haptic('heavy') === false);
  S.store.put('k', '{}');
  check('web: hydrate resolves null', (await S.store.hydrate('k')) === null);
  check('web: gc resolves ok:false', (await S.gc.submitScore('lb', 5)).ok === false);
  S.ready();
  check('web: made no plugin calls', env.calls.length === 0, env.names());
}

async function att() {
  const env = makeEnv({ plugins: { AdMob: { att: 'notDetermined', attAfterRequest: 'authorized', consent: 'NOT_REQUIRED' } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  const n = env.names();
  check('att: requested at launch', n.includes('att.request'), n);
  check('att: before AdMob.initialize', n.indexOf('att.request') < n.indexOf('initialize'), n);
  check('att: consent requested after initialize', n.indexOf('initialize') < n.indexOf('requestConsentInfo'), n);
  const prep = env.args('prepareRewardVideoAd')[0];
  check('att: authorized + consent not required = personalized (npa false)', prep && prep.npa === false && prep.adId === CFG.rewarded, prep);

  const denied = makeEnv({ plugins: { AdMob: { att: 'notDetermined', attAfterRequest: 'denied' } } });
  denied.Shell.configure(cfg());
  await denied.advance(50);
  const p2 = denied.args('prepareRewardVideoAd')[0];
  check('att: declined = non-personalized ads (npa true)', p2 && p2.npa === true, p2);

  const eea = makeEnv({ plugins: { AdMob: { att: 'authorized', consent: 'REQUIRED' } } });
  eea.Shell.configure(cfg());
  await eea.advance(50);
  check('att: already decided = no second prompt', eea.count('att.request') === 0);
  const p3 = eea.args('prepareRewardVideoAd')[0];
  check('att: consent REQUIRED without a form = npa true', p3 && p3.npa === true, p3);
}

async function rewarded() {
  // reward, then dismiss
  let env = makeEnv();
  env.Shell.configure(cfg());
  await env.advance(100);
  check('rewarded: preloaded at configure', env.count('prepareRewardVideoAd') === 1 && env.Shell.ads.rewardedReady() === true);
  const seen = [];
  env.Shell.ads.onRewardedReady((v) => seen.push(v));
  let res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(1500);
  check('rewarded: not settled when the reward lands (the ad is still up)', res === null, res);
  await env.advance(1000);
  check('rewarded: reward + dismiss = rewarded:true', res && res.rewarded === true, res);
  await env.advance(100);
  check('rewarded: next ad prepared after the dismissal', env.count('prepareRewardVideoAd') === 2 && env.Shell.ads.rewardedReady() === true);
  check('rewarded: onRewardedReady replays and follows (true, false, true)', JSON.stringify(seen) === '[true,false,true]', seen);

  // dismissed early: no reward
  env = makeEnv({ plugins: { AdMob: { rewardedShow: 'skip' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(3000);
  check('rewarded: closed early = rewarded:false', res && res.rewarded === false, res);

  // show rejects
  env = makeEnv({ plugins: { AdMob: { rewardedShow: 'reject' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(20);
  check('rewarded: a rejected show settles at once, not rewarded', res && res.rewarded === false && res.reason === 'failed', res);
  await env.advance(100);
  check('rewarded: and prepares the next ad', env.count('prepareRewardVideoAd') === 2 && env.Shell.ads.rewardedReady() === true);

  // failed to show
  env = makeEnv({ plugins: { AdMob: { rewardedShow: 'failShow' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(50);
  check('rewarded: onRewardedVideoAdFailedToShow = rewarded:false', res && res.rewarded === false, res);

  // never reaches the screen
  env = makeEnv({ plugins: { AdMob: { rewardedShow: 'silent' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(7000);
  check('rewarded: silent show still pending before the watchdog', res === null);
  const second = await env.Shell.ads.showRewarded();
  check('rewarded: a second show while one is in flight is refused', second.rewarded === false && second.reason === 'busy', second);
  await env.advance(1500);
  check('rewarded: watchdog settles a show that never appeared', res && res.rewarded === false, res);

  // reward earned, dismissal never reported: settled by the cap, still rewarded
  env = makeEnv({ plugins: { AdMob: { rewardedShow: 'noDismiss' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(149000);
  check('rewarded: no dismissal yet = still pending', res === null, res);
  await env.advance(2000);
  check('rewarded: a missing dismissal is capped at 150 s and keeps the reward', res && res.rewarded === true, res);

  // no fill, then a retry with backoff
  let loads = 0;
  env = makeEnv({ plugins: { AdMob: { rewardedLoad: () => (++loads === 1 ? 'fail' : 'ok') } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  check('rewarded: failed load leaves it not ready', env.Shell.ads.rewardedReady() === false);
  await env.advance(30000);
  check('rewarded: retried after 30 s and loaded', loads === 2 && env.Shell.ads.rewardedReady() === true, loads);

  // still loading when the player taps: waits, then shows
  env = makeEnv({ plugins: { AdMob: { loadDelay: 3000 } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(6000);
  check('rewarded: a tap while loading waits for the load and shows it', env.count('showRewardVideoAd') === 1 && res && res.rewarded === true, res);

  // never loads: gives up after the wait with reason nofill
  env = makeEnv({ plugins: { AdMob: { rewardedLoad: 'hang' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showRewarded().then((r) => { res = r; });
  await env.advance(6500);
  check('rewarded: no ad within 6 s = nofill, nothing shown', res && res.rewarded === false && res.reason === 'nofill' && env.count('showRewardVideoAd') === 0, res);
}

async function inter() {
  let env = makeEnv();
  env.Shell.configure(cfg());
  await env.advance(100);
  check('inter: not preloaded unless asked', env.count('prepareInterstitial') === 0);
  let res = null;
  env.Shell.ads.showInterstitial().then((r) => { res = r; });
  await env.advance(2000);
  check('inter: loads on demand, shows, settles on dismissal', res && res.shown === true && env.count('showInterstitial') === 1, res);
  await env.advance(100);
  check('inter: next one prepared after the dismissal', env.count('prepareInterstitial') === 2);

  env = makeEnv();
  env.Shell.configure(cfg({ preloadInterstitial: true }));
  await env.advance(100);
  check('inter: preloadInterstitial loads one at launch', env.count('prepareInterstitial') === 1);

  env = makeEnv({ plugins: { AdMob: { interLoad: 'hang' } } });
  env.Shell.configure(cfg());
  await env.advance(100);
  res = null;
  env.Shell.ads.showInterstitial().then((r) => { res = r; });
  await env.advance(4500);
  check('inter: a slow load is skipped after 4 s, not waited on', res && res.shown === false && res.reason === 'nofill', res);
}

async function iap() {
  let env = makeEnv({ plugins: { Purchases: { customerInfo: {
    allPurchasedProductIdentifiers: ['fort_gems_500', 'fort_noads', 'remove_ads'],
    nonSubscriptionTransactions: [{ productIdentifier: 'fort_gems_80' }],
    entitlements: { all: { starter: { productIdentifier: 'fort_starter:base' } } }
  } } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  check('iap: configured with the RevenueCat key', JSON.stringify(env.args('configure')) === '[{"apiKey":"appl_TEST"}]', env.args('configure'));
  const gp = env.args('getProducts')[0];
  check('iap: products fetched at launch as NON_SUBSCRIPTION', gp && gp.type === 'NON_SUBSCRIPTION' && gp.productIdentifiers.join() === CFG.products.join(), gp);
  check('iap: localized price once loaded', env.Shell.iap.price('fort_noads') === '€10,99' && env.Shell.iap.price('fort_gems_1200') === null);
  const list = await env.Shell.iap.getProducts(['fort_gems_80', 'nope']);
  check('iap: getProducts maps id/price/title, skips unknown ids', JSON.stringify(list) === JSON.stringify([{ id: 'fort_gems_80', price: '€12,99', title: 'T fort_gems_80' }]), list);
  const ok = await env.Shell.iap.purchase('fort_gems_500');
  check('iap: purchase ok', ok.ok === true && env.args('purchaseStoreProduct').includes('fort_gems_500'), ok);
  const unknown = await env.Shell.iap.purchase('fort_gems_1200');
  check('iap: a product the store lacks fails cleanly', unknown.ok === false && /not in the App Store yet/.test(unknown.error), unknown);
  const owned = await env.Shell.iap.owned();
  check('iap: owned = configured non-consumables only, from all three CustomerInfo fields', JSON.stringify(owned) === '["fort_starter","fort_noads"]', owned);
  const restored = await env.Shell.iap.restore();
  check('iap: restore reports the same set', JSON.stringify(restored) === '["fort_starter","fort_noads"]', restored);
  check('iap: owned() never triggers a restore sheet', env.count('restorePurchases') === 1);

  env = makeEnv({ plugins: { Purchases: { purchase: 'cancel' } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  const c = await env.Shell.iap.purchase('fort_noads');
  check('iap: cancel = { ok:false, cancelled:true }', c.ok === false && c.cancelled === true, c);
  env = makeEnv({ plugins: { Purchases: { purchase: 'error' } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  const e = await env.Shell.iap.purchase('fort_noads');
  check('iap: store error = { ok:false, error }', e.ok === false && !e.cancelled && /unavailable/.test(e.error), e);

  // restore sheet dismissed, receipt sync finds the purchase
  env = makeEnv({ plugins: { Purchases: { restore: 'cancel', customerInfo: { allPurchasedProductIdentifiers: ['fort_noads'] } } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  const rescued = await env.Shell.iap.restore();
  check('iap: a failed restore is rescued by syncPurchases', JSON.stringify(rescued) === '["fort_noads"]' && env.count('syncPurchases') === 1, rescued);
  // ...and finds nothing: the cancellation is reported, not "nothing to restore"
  env = makeEnv({ plugins: { Purchases: { restore: 'cancel', customerInfo: {} } } });
  env.Shell.configure(cfg());
  await env.advance(50);
  const err = await env.Shell.iap.restore().then(() => null, (x) => x);
  check('iap: an empty rescue rejects with the cancellation', err && err.cancelled === true && /cancelled/i.test(err.message), err && err.message);

  env = makeEnv();
  env.Shell.configure(cfg({ rcKey: '' }));
  await env.advance(50);
  check('iap: no RevenueCat key = no store, nothing configured', env.Shell.iap.available() === false && env.count('configure') === 0);
}

async function notify() {
  const env = makeEnv();
  const S = env.Shell;
  const at = Date.now() + 3600e3;
  const ok = await S.notify.schedule({ id: 'lab:dmg', at, title: 'Research complete', body: 'Rifle II is ready.' });
  check('notify: scheduled', ok === true);
  check('notify: permission checked then requested once', env.count('notes.check') === 1 && env.count('notes.request') === 1);
  const sch = env.args('notes.schedule')[0].notifications[0];
  check('notify: int id from the string id, Date at, title/body', sch.id === S.notify.id('lab:dmg') && Number.isInteger(sch.id) && sch.id > 0 &&
    sch.schedule.at instanceof Date && sch.schedule.at.getTime() === at && sch.title === 'Research complete', sch);
  await S.notify.schedule({ id: 'lab:dmg', at: at + 1000, title: 'Research complete', body: 'x' });
  check('notify: rescheduling cancels the old one first (same id)', env.args('notes.cancel').filter((a) => a.notifications[0].id === sch.id).length === 2);
  check('notify: permission not asked again', env.count('notes.request') === 1);
  check('notify: a time in the past is ignored', (await S.notify.schedule({ id: 'x', at: Date.now() - 1, title: '', body: '' })) === false);
  await S.notify.cancel('daily');
  check('notify: cancel by string id', env.args('notes.cancel').some((a) => a.notifications[0].id === S.notify.id('daily')));
  const both = makeEnv();
  // the game schedules its daily reminder while booting, before Plat.boot configures the shell
  const p = both.Shell.notify.schedule({ id: 'daily', at, title: 'Daily Ops', body: 'x' });
  both.Shell.configure(cfg());
  await both.advance(50);
  await p;
  const bn = both.names();
  check('notify: the permission sheet waits for the launch ATT prompt', bn.indexOf('att.request') >= 0 && bn.indexOf('att.request') < bn.indexOf('notes.check'), bn);
  const denied = makeEnv({ plugins: { LocalNotifications: { perm: 'prompt', grant: 'denied' } } });
  check('notify: denied permission = not scheduled', (await denied.Shell.notify.schedule({ id: 'a', at, title: '', body: '' })) === false && denied.count('notes.schedule') === 0);
}

async function haptic() {
  const env = makeEnv();
  ['light', 'medium', 'heavy', 'success', 'bogus'].forEach((k) => env.Shell.haptic(k));
  await settle();
  const got = env.calls.map((c) => c.name + ':' + (c.args.style || c.args.type));
  check('haptic: kinds map to ImpactStyle / NotificationType values', JSON.stringify(got) ===
    JSON.stringify(['impact:LIGHT', 'impact:MEDIUM', 'impact:HEAVY', 'notification:SUCCESS', 'impact:LIGHT']), got);
}

async function store() {
  const KEY = 'theFortSave';
  // purged localStorage: the game writes a fresh save before hydrate; the native copy wins
  const gameSave = (env, json) => { env.ls.set(KEY, json); env.Shell.store.put(KEY, json); }; // what index.html saveWrite() does
  let env = makeEnv({ prefs: { [KEY]: '812\n{"best":44}' } });
  gameSave(env, '{"best":0}');
  gameSave(env, '{"best":0,"x":1}');
  await env.advance(5000);
  check('store: nothing reaches native before hydrate', env.count('prefs.set') === 0);
  let json = await env.Shell.store.hydrate(KEY);
  check('store: purged localStorage -> native copy restored', json === '{"best":44}' && env.ls.get(KEY) === '{"best":44}' && env.ls.get(KEY + '.seq') === '812', json);
  await env.advance(5000);
  check('store: the fresh boot save is discarded, never mirrored', env.count('prefs.set') === 0);
  env.Shell.store.put(KEY, '{"best":45}');
  await env.advance(1300);
  check('store: next save mirrored with the next sequence number', env.prefs.get(KEY) === '813\n{"best":45}', env.prefs.get(KEY));

  // purged while the native copy is young: the boot saves outnumber it, and it must still win
  env = makeEnv({ prefs: { [KEY]: '2\n{"best":7}' } });
  for (let i = 0; i < 4; i++) gameSave(env, '{"fresh":' + i + '}');
  json = await env.Shell.store.hydrate(KEY);
  check('store: purged at boot beats a higher boot-time sequence', json === '{"best":7}' && env.ls.get(KEY) === '{"best":7}' && env.ls.get(KEY + '.seq') === '2', json);

  // local newer (native write lost when the app died): local wins and is mirrored
  env = makeEnv({ localStorage: { [KEY]: '{"best":9}', [KEY + '.seq']: '50' }, prefs: { [KEY]: '48\n{"best":8}' } });
  json = await env.Shell.store.hydrate(KEY);
  await env.advance(10);
  check('store: newer localStorage kept', json === null && env.ls.get(KEY) === '{"best":9}');
  check('store: and mirrored out at once', env.prefs.get(KEY) === '50\n{"best":9}', env.prefs.get(KEY));

  // native newer (localStorage write lost): native wins
  env = makeEnv({ localStorage: { [KEY]: '{"best":8}', [KEY + '.seq']: '48' }, prefs: { [KEY]: '50\n{"best":9}' } });
  json = await env.Shell.store.hydrate(KEY);
  check('store: newer native copy wins over an older local one', json === '{"best":9}' && env.ls.get(KEY + '.seq') === '50', json);

  // in sync: nothing written
  env = makeEnv({ localStorage: { [KEY]: '{"a":1}', [KEY + '.seq']: '7' }, prefs: { [KEY]: '7\n{"a":1}' } });
  json = await env.Shell.store.hydrate(KEY);
  await env.advance(5000);
  check('store: in sync = no restore, no write', json === null && env.count('prefs.set') === 0);

  // first launch: nothing anywhere, then a save
  env = makeEnv();
  json = await env.Shell.store.hydrate(KEY);
  check('store: first launch hydrates to null', json === null);
  for (let i = 0; i < 5; i++) env.Shell.store.put(KEY, '{"n":' + i + '}');
  await env.advance(1000);
  check('store: a burst of saves is debounced', env.count('prefs.set') === 0);
  await env.advance(300);
  check('store: one write with the last save', env.count('prefs.set') === 1 && env.prefs.get(KEY) === '5\n{"n":4}', env.prefs.get(KEY));

  // backgrounding flushes at once
  env.Shell.store.put(KEY, '{"n":5}');
  env.emit('App', 'appStateChange', { isActive: false });
  await settle();
  check('store: appStateChange(inactive) flushes immediately', env.prefs.get(KEY) === '6\n{"n":5}', env.prefs.get(KEY));
  check('store: app.onState reports the background', env.Shell.app.active() === false);
  env.emit('App', 'appStateChange', { isActive: true });
  env.Shell.store.put(KEY, '{"n":6}');
  await env.hide();
  check('store: visibilitychange(hidden) flushes too', env.prefs.get(KEY) === '7\n{"n":6}', env.prefs.get(KEY));
  env.Shell.store.put(KEY, '{"n":7}');
  check('store: while hidden, a save is written at once', env.prefs.get(KEY) === '8\n{"n":7}', env.prefs.get(KEY));

  // Preferences missing: hydrate still resolves
  env = makeEnv({ plugins: { Preferences: false } });
  check('store: no Preferences plugin = hydrate null, no throw', (await env.Shell.store.hydrate(KEY)) === null);
}

async function gc() {
  let env = makeEnv();
  env.Shell.configure(cfg());
  await env.advance(100);
  check('gc: no leaderboard id = never signs in', env.count('gc.signIn') === 0);
  check('gc: submit without an id is refused', (await env.Shell.gc.submitScore('', 30)).ok === false && env.count('gc.submitScore') === 0);

  env = makeEnv();
  env.Shell.configure(cfg({ leaderboards: ['fort.daily'] }));
  await env.advance(100);
  const n = env.names();
  check('gc: signs in once ATT and consent are done', env.count('gc.signIn') === 1 && n.indexOf('gc.signIn') > n.indexOf('requestConsentInfo'), n);
  const r = await env.Shell.gc.submitScore('fort.daily', 31.6);
  check('gc: score submitted, rounded', r.ok === true && JSON.stringify(env.args('gc.submitScore')) === '[{"leaderboardId":"fort.daily","score":32}]', env.args('gc.submitScore'));
  check('gc: an unknown board is refused', (await env.Shell.gc.submitScore('other', 1)).ok === false);
}

async function splash() {
  let env = makeEnv();
  env.Shell.ready();
  env.Shell.ready();
  await env.advance(10000);
  check('splash: ready() hides it once', env.count('splash.hide') === 1 && env.args('splash.hide')[0].fadeOutDuration === 250);
  env = makeEnv();
  await env.advance(7900);
  check('splash: still up before the fallback', env.count('splash.hide') === 0);
  await env.advance(200);
  check('splash: fallback hides it after 8 s', env.count('splash.hide') === 1);
  env = makeEnv({ build: '42' });
  check('build number exposed', env.Shell.build === '42');
  check('liveAds: false unless the build says live', env.Shell.liveAds === false && makeEnv({ ads: 'test' }).Shell.liveAds === false);
  check('liveAds: true in a release build', makeEnv({ ads: 'live' }).Shell.liveAds === true);
}

(async () => {
  for (const s of [web, att, rewarded, inter, iap, notify, haptic, store, gc, splash]) {
    try { await s(); } catch (e) { failures.push(s.name + ' threw: ' + (e && e.stack || e)); }
  }
  console.log('test_shell: ' + pass + ' passed, ' + failures.length + ' failed');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exit(failures.length ? 1 : 0);
})();
