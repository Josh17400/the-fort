// Witness hookup for The Fort. index.html imports this module only when the page is opened by Witness
// (?witness=...) or in record mode (?witness_record=...), so the web and App Store builds never load it.
// The game is a classic script: its top-level names (G, S, running, startRun, ...) are global bindings, read here directly.
import witness from "./witness.js";

const VIEW = [innerWidth, innerHeight];
const r1 = (v) => Math.round(v * 10) / 10;

// Stable ids for the game's plain enemy/crate objects (they have none of their own).
let ids = new WeakMap(), nextId = 1;
let runNo = 0;
const idOf = (o) => { let i = ids.get(o); if (!i) { i = nextId++; ids.set(o, i); } return i; };

// Save profiles, the same three the .qa smoke tests use. "mid" is a seeded half-upgraded fort.
function profile(name, seed) {
  const s = { bank: 0, best: 0, tkills: 0, lv: {}, rs: {}, rp: 0, rsv: 1, seen: {}, set: { vol: 60, music: false, gfx: "high", blurPause: false } };
  // music: false. The soundtrack streams through <audio> elements, which Witness can't capture, and a track that fails to load
  // in the headless browser is re-picked with Math.random at real-time moments, which would break determinism.
  if (name === "maxed") {
    Object.assign(s, { bank: 1e15, best: 60, tkills: 9999 });
    U.forEach((u) => { s.lv[u.id] = isFinite(u.max) ? u.max : 40; });
    RLINES.lines.forEach((l) => { s.rs[l.id] = l.t.length - 1; });
  } else if (name === "mid") {
    Object.assign(s, { bank: 1e9, best: 45, tkills: 999 });
    let sd = seed >>> 0 || 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    U.forEach((u) => { if (rnd() < 0.7) s.lv[u.id] = Math.floor(rnd() * (isFinite(u.max) ? u.max + 1 : 25)); });
  } else if (name === "late") {
    // a steady mid-campaign save: every Armory line at 40% of its cap (uncapped lines at 16), all R&D at 40%
    Object.assign(s, { bank: 5e6, best: 45, tkills: 3000 });
    U.forEach((u) => { s.lv[u.id] = Math.floor((isFinite(u.max) ? u.max : 40) * 0.4); });
    RLINES.lines.forEach((l) => { s.rs[l.id] = Math.floor((l.t.length - 1) * 0.4); });
  } else if (name !== "fresh") throw new Error(`unknown scene "${name}" (fresh | mid | late | maxed)`);
  return s;
}

// A new AudioContext per reset: the ambience LFOs, gain ramps and the audio RNG would otherwise carry over from the previous
// run, and audio() draws Math.random for its noise bed when it builds a context (in startRun), so the first run must look like any other.
function freshAudio() {
  if (AU.ctx) try { AU.ctx.close(); } catch (e) {}
  Object.assign(AU, { ctx: null, master: null, mix: null, sfx: null, big: null, ui: null, amb: null, duck: null, mduck: null, rev: null, nb: null,
    live: 0, last: {}, lv: {}, bed: null, gust: null, night: null, rotor: null, eng: null, mbus: null, farT: 0, duckT: 0, duckG: 1 });
  Object.assign(MU, { cur: null, last: -1, blocked: null });
  _ar = 0x2545F491;
  for (const k in SB) delete SB[k];   // baked sound variants: a warm cache would play a different variant than a cold one
  SBQ.length = 0;
}

// Who hit the fort last, for the harness's death lines and report (state.lastHit). Every hit goes through the game's
// damageFort(d, src) with src = the attacker's type (shells and bombs carry the type that fired them); wrap it.
let lastHit = null, hitN = 0;
const damageFort0 = damageFort;
globalThis.damageFort = function (d, src) {
  const k = src || "unknown";
  lastHit = { by: (INTEL[k] && INTEL[k][0]) || k, type: k, n: ++hitN };
  return damageFort0.apply(this, arguments);
};

// Name every game sound for Witness (play's "sounds:" line, listen): a tester can't hear the deny buzz of a power that can't fire.
const sfx0 = sfx;
globalThis.sfx = function (n) { witness.sound(String(n)); return sfx0.apply(this, arguments); };

function reset({ seed, scene, params = {} }) {
  if (G && G.swAsk) swClose();
  running = false; paused = false; G = null; mouse.down = false;
  ids = new WeakMap(); nextId = 1; runNo = 0; lastHit = null; hitN = 0;
  const s = profile(scene || "fresh", seed);
  // params.cmd: Commander tree on this save. "all" = every node maxed (loadout params.eq or laser/rail/shock), a number = that much Valor
  if (params.cmd === "all") { s.cmd = { v: 0, tot: 0, on: 1, lv: Object.fromEntries(CMD.map((q) => [q.id, q.cost.length])), eq: params.eq || ["laser", "rail", "shock"] }; }
  else if (params.cmd != null) s.cmd = { v: +params.cmd || 0, tot: 0, on: 1, lv: params.lv || {}, eq: params.eq || [] };
  if (params.map) { s.map = params.map; s.maps = {}; for (const m of MAPS) { if (m.id === params.map) break; s.maps[m.id] = { stars: 2, cleared: true }; } }
  freshAudio();
  localStorage.clear();
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  loadSave(); medalSync();
  for (const m of document.querySelectorAll(".modal.on")) m.classList.remove("on");
  lastRunMsg = ""; lastCause = null; lastAAR = null;
  showScreen("home"); renderHome();
  resize();   // resets the zoom (sc) the last run's camera left behind, and clears the battle canvas
  // Bake the ground, fog and fort for this save now. The game's own idleBake() runs on a 2 s setInterval made at boot, before
  // Witness took over the clock, so it fires on REAL time: a run could start on the previous save's ground (maxed vs fresh).
  if (hiGfx()) { const k = _ter && _ter.key; terrainBake(); fogBake(vision()); fortBake(fortHalf(), L("walls"), true); if (_ter.key !== k) rasterNow(_ter.c); }
  // the intel card queue, the medal toast queue and the HUD lane's busy clock outlive a run (module-level in the game): start clean
  _mtQ.length = 0; clearTimeout(_mtW); clearTimeout(_mtHide); _mtOn = false; _mtCur = null; $("medalToast").classList.remove("on");
  intelG = null; intelQ = []; intelCur = null; intelEnd = 0; intelLast = 0; $("intel").classList.remove("on"); HL.busyT = 0;
  SM.dur = 0; _smSilo = -1e9;   // a cinematic slow-mo left running by the last test would slow this run's first frames
  last = performance.now(); acc = 0;   // the loop's clock: the real one ran before Witness took over
  if (params.run) { startRun(); runNo = 1; if (params.charges != null) G.cm.pts = params.charges * CM_PTS; if (params.wave) G.wave = params.wave - 1; }
}

function enemy(e, air) {
  return { id: idOf(e), type: air ? "Air:" + e.type : e.type, pos: [r1(e.x), r1(e.y)], hp: r1(e.hp), maxHp: r1(e.max),
    hostile: true, dist: r1(Math.hypot(e.x, e.y)), inSight: visible(e), ...(e.boss || e.tb ? { boss: true } : {}),
    ...(e.el ? { hvt: e.el, ...(e.shd > 0 ? { shield: r1(e.shd) } : {}) } : {}) };
}

function snapshot() {
  const g = G, inRun = !!(g && running);
  const screen = inRun ? (g.choosing ? "directive" : paused ? "paused" : "battle") : g && g.swAsk ? "second-wind" : g && g.over ? "after-action" : "base";
  const st = {
    screen, theater: S.map, bank: Math.floor(S.bank), rp: S.rp | 0, gems: S.gems | 0, best: Math.max(S.best, inRun ? g.wave : 0),   // the game's 10 s autosave (real clock) bumps S.best mid-run: report what it would hold
    wave: g ? g.wave : 0, rookie: !!(g && g.rookie), kills: g ? g.kills : 0, time: g ? r1(g.time) : 0,
    dead: !!(g && g.over && !g.retreated), won: false,
    // each run is its own scene, so the harness forgets the last run's enemies; a retreat isn't a death
    scene: inRun || (g && g.over) ? "run " + runNo : "base",
    goal: inRun ? "Hold the fort: survive as many waves as you can" : "At base: spend cash and research, then deploy",
  };
  // the NEW CONTACT intel card is HTML (not on the canvas): pass its words on
  // banners (WAVE 5, THEATER CLEARED, boss warnings) are drawn on the canvas, the intel card is HTML: pass both on as words
  const say = [];
  if (inRun && g.bq && g.bq.cur) say.push(g.bq.cur.t + (g.bq.cur.sub ? " · " + g.bq.cur.sub : ""));
  if (inRun && $("intel").classList.contains("on")) say.push("NEW CONTACT: " + $("intelName").textContent + ". " + $("intelTip").textContent);
  if (g && g.over && !g.swAsk && !g.retreated) say.push(`FORT FELL at wave ${g.wave}` + (lastCause && lastCause.top.length ? " · most damage from: " + lastCause.top.join(", ") : ""));
  if (say.length) st.notice = say.join(" | ");
  // screen = (world - pos) * zoom + the canvas centre: the game's own mapping (toWorld), so tap:target lands on the enemy
  st.lastHit = lastHit;
  if (inRun) st.camera = { pos: [0, 0], zoom: sc, center: true };   // only in battle: off it, sc keeps the last run's zoom
  if (g) {
    st.player = { id: 0, type: "Fort", pos: [0, 0], hp: r1(g.hp), maxHp: r1(g.maxHp), walls: r1(g.wallHp), wallsMax: r1(g.wallMax),
      target: g.sold[0].tgt && g.sold[0].tgt.hp > 0 ? idOf(g.sold[0].tgt) : null };
    const ents = [];
    for (const e of g.enemies) if (e.hp > 0) ents.push(enemy(e, false));
    for (const e of g.sky || []) if (e.hp > 0) ents.push(enemy(e, true));
    for (const c of g.crates) if (c.life > 0) ents.push({ id: idOf(c), type: "Crate", pos: [r1(c.x), r1(c.y)], item: true, hostile: false, kind: c.k || "cash" });
    st.entities = ents;
    st.dialogue = g.choosing ? { speaker: "Command", text: "Field commendation: pick one directive for this run",
      options: g.choosing.map((p) => p.name + ": " + p.desc),
      ready: performance.now() - perkOpenT >= 650 } : null;   // pickPerk() ignores picks for 650 ms after the card opens (anti-misclick)
  } else st.entities = [];
  // Commander powers: Valor (account), the Command meter and each equipped power's state (run)
  const c = S.cmd || {};
  st.command = { valor: c.v | 0, open: !!cmdOpen() };
  if (g && g.cm) { const m = g.cm; Object.assign(st.command, { charges: r1(m.pts / CM_PTS), eq: m.eq.slice(), armed: m.arm, used: m.used, hvtKills: m.el, hvtSpawned: m.hlog.length, legend: m.lv.legend ? m.lg : null,
    powers: m.eq.map((id) => { const q = CMB[id], act = cmActive(id), cd = (m.cd[id] || 0) - g.time; return id + (act > 0 ? " active " + r1(act) + "s" : cd > 0 ? " cooldown " + r1(cd) + "s" : m.pts >= q.ch * CM_PTS ? " READY" : " needs " + q.ch + " charges"); }) }); }
  if (lastAAR && lastAAR.vl) st.command.lastValor = lastAAR.vl.n;
  return st;
}

const nearestEnemy = () => { let b = null, bd = Infinity; for (const e of G.enemies) if (e.hp > 0 && visible(e)) { const d = Math.hypot(e.x, e.y); if (d < bd) { bd = d; b = e; } } return b; };

// Witness "action:<name>" input. The tester's controls map onto the game's own buttons: LOCK ON, crates, the airstrike and FRAG.
function action(name, down) {
  if (!down || !G || !running || paused) return;
  if (name === "lock") $("aimBtn").onclick();
  else if (name === "grab") { const c = G.crates.filter((c) => c.life > 0).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]; if (c) grabCrate(c); }
  else if (name === "strike") { const t = nearestEnemy(); if (!t) return; toggleAir(); if (G.airArmed) { G.airArmed = false; callAir(t.x, t.y); dqAdd("strike", 1); } }
  else if (name === "frag") { const t = nearestEnemy(); if (t) throwNade(t.x, t.y); }
  // Command powers 1-3 (the buttons above AIR) and LEGEND; a power that wants a spot or an enemy gets the nearest visible one
  else if (/^power[1-3]$/.test(name)) { cmUse(+name.slice(5) - 1); if (G.cm.arm) { const t = nearestEnemy(); if (t) cmTap(t.x, t.y); else G.cm.arm = null; } }
  else if (name === "legend") cmLegend();
}

// Base-screen calls: the Armory, R&D and theater menus are HTML, so the tester reaches them through these.
const calls = {
  base: { help: "the base menu: Armory upgrades (cash) and research (RP) you can buy now", run: () => {
    const arm = U.filter((u) => !lockWhy(u) && L(u.id) < u.max).map((u) => { const c = Math.ceil(costOf(u, L(u.id))); return `${u.id} (${u.name}) Lv${L(u.id)} $${c}${S.bank >= c ? "" : " (can't afford)"}`; });
    const res = RLINES.lines.filter((l) => !l.on).map((l) => `${l.id} T${rsOwned(l.id)}`);
    return `cash $${Math.floor(S.bank)} · RP ${S.rp | 0} · best wave ${S.best} · theater ${S.map} | ARMORY: ${arm.join("; ")} | RESEARCH: ${res.join(", ")}`;
  } },
  buy: { args: "id", help: "buy one Armory level (ids from base)", run: (id) => {
    const u = UB[id]; if (!u) return { error: `no upgrade "${id}" (ids are in the ARMORY list of call base)` };
    if (running) return { error: "the Armory is closed during battle" };
    const why = lockWhy(u); if (why) return { error: `${id} is locked: ${typeof why === "string" ? why : JSON.stringify(why)}` };
    if (L(id) >= u.max) return { error: `${id} is maxed` };
    const c = Math.ceil(costOf(u, L(id))); if (S.bank < c) return { error: `can't afford ${id}: costs $${c}, you have $${Math.floor(S.bank)}` };
    buyUpgrade(id); renderHome(); return `bought ${id}: now Lv${L(id)}, $${Math.floor(S.bank)} left`; } },
  research: { args: "id", help: "start researching the next tier (ids from base)", run: (id) => {
    if (!RLINES[id]) return { error: `no research line "${id}"` };
    const ok = buyResearch(id); renderHome(); if (ok) return `research ${id} started`;
    // say which reason, as the R&D screen does
    const r = RLINES[id], k = rsOwned(id) + 1, why = !S.lab ? "the lab isn't open yet" : labOf(id) ? "already researching it" : !labFree() ? "lab busy: every slot is in use" : rsDone(id) ? `refit needs ${refitCost(S.rf[id] | 0)} RP, you have ${Math.floor(S.rp)}` : rsWhy(id, k) || `needs ${rsPrice(id, k).rp} RP, you have ${Math.floor(S.rp)}`;
    return { error: `can't start ${id}: ${why}` }; } },
  deploy: { help: "start a run from the base", run: () => { if (running) return { error: "already in battle" }; if (G && G.swAsk) swDecline(); showScreen("home"); startRun(); runNo++; return `deployed: run ${runNo}, first wave ${G.wave + 1}`; } },
  retreat: { help: "end the current run now", run: () => { if (!running) return { error: "not in battle" }; G.retreated = true; endRun(true); return `retreated at wave ${G.wave}`; } },
  decline: { help: "on the Second Wind offer: end the run", run: () => { if (G && G.swAsk) { swDecline(); return "run ended"; } return { error: "no Second Wind offer is open" }; } },
  theater: { args: "id", help: "switch theater at the base (desert, ...)", run: (id) => switchMap(id) ? `now in ${id}` : { error: `can't switch to "${id}" (unknown, locked, already there, or in battle); theaters: ${MAPS.map((m) => m.id + (mapOpen(m.id) ? "" : " (locked)")).join(", ")}` } },
  command: { help: "the Commander tree: Valor, each node's level and cost (Valor is earned at the end of every run)", run: () => {
    if (!cmdOpen()) return { error: "the Command tree opens once you have reached wave " + CM_OPEN };
    const c = cmdS(); return `Valor ${c.v} · loadout ${c.eq.join(", ") || "none"} (${cmSlots(c)} slots) | ` + "Valor is earned at the end of every run | " + CMD.map((q) => `${q.id} (${q.name}) Lv${cpL(q.id)}/${q.cost.length}` + (cmMaxed(q) ? " MAX" : cmNeed(q) ? " locked: " + cmNeed(q) : ` ${cmCost(q)} Valor${c.v >= cmCost(q) ? "" : " (can't afford)"}`)
      + (q.d ? " · " + (typeof q.d === "function" ? q.d(Math.max(1, Math.min(q.cost.length, cpL(q.id) + 1))) : q.d) : "")).join("; "); } },   // what the Command screen shows a player: description and why a node is locked
  cmdbuy: { args: "id", help: "unlock or upgrade a Commander node (ids from command)", run: (id) => {
    const q = CMB[id]; if (!q) return { error: `no node "${id}"` }; if (running) return { error: "the Command tree is closed during battle" };
    if (cmMaxed(q)) return { error: id + " is maxed" }; const need = cmNeed(q); if (need) return { error: need };
    if (!cmBuy(id)) return { error: `can't afford ${id}: costs ${cmCost(q)} Valor, you have ${cmdS().v}` }; renderHome(); return `${id} now Lv${cpL(id)} · loadout ${cmdS().eq.join(", ")}`; } },
  equip: { args: "id", help: "equip / unequip an owned power for battle", run: (id) => { if (running) return { error: "set the loadout at base" }; cmEquip(id); renderHome(); return "loadout: " + (cmdS().eq.join(", ") || "none"); } },
  js: { args: "expr", help: "DEV ONLY: evaluate an expression in the page", run: (x) => { try { return String((0, eval)(x)); } catch (e) { return { error: String(e) }; } } },
  speed: { args: "n", help: "battle speed (the speeds this save has unlocked)", run: (n) => {
    if (!G || !running) return { error: "speed is set during battle" };
    const ok = speedOpts(); if (!ok.includes(+n)) return { error: `speed ${n} isn't available: ${ok.join("/")}` };
    G.simSpeed = +n; syncSpeedBtn(); return `speed ${n}x`; } },
};

await witness.start({
  name: "The Fort", fps: 60, size: VIEW, canvas: cv,
  keys: ["1", "2", "3", "q", "g", "f", "t", "p", "escape", "enter"],
  reset, snapshot, action, calls,
  scope: () => ({ G, S, running, paused }),
});
