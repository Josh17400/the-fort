# The Fort — Handoff

Top-down modern-military roguelite fort defense. Tap/click enemies to shoot them, earn money per kill, die, then spend it on upgrades at base. Played on desktop and on iPhone as a home-screen web app.

- **Live:** https://josh17400.github.io/the-fort/ (GitHub Pages, repo `Josh17400/the-fort`, branch `main`)
- **Last pushed commit:** `cb7d790` "Desktop R&D stepper: tiers without a card (finished or two-plus ahead) are inert instead of dead buttons"
- **Whole game = one file:** `index.html` (canvas 2D + optional WebGL, DOM menus, WebAudio). No build step. Pushing to `main` deploys.

---

## Owner rules (read first)

1. **Use Opus 5.5 for every agent/subagent** (`model: "opus"`). Never Sonnet or Haiku, even for "medium" tasks.
2. **Owner UI decisions. Do not revert these in UI passes.** A comment block `OWNER DECISIONS` sits just above `// ---------------- BASE ----------------` in index.html.
   - The after-action report (`.panel.aar`) is **gold/yellow** so it stands out.
   - Base: `#picks` (Quartermaster's Picks) and `#nextUnl` (Next Unlocks) stay **removed**. Keep the Mission Briefing, which shows what the current base can do.
   - Armory shows **only unlocked, not-maxed** upgrades (`avail=u=>!lockWhy(u)&&L(u.id)<u.max`). There is no locked list, and empty category tabs are hidden.
   - R&D shows **only lines whose next tier is open** (`rsVis`), and only the **current + next tier** for each line.
   - The goal is a **slow, non-overwhelming roll-out** of progression.
3. Research Points should be **hard to earn** (the owner complained about 29 RP by wave 6).
4. Weapons shouldn't feel like "needles". Upgrades are endless (`max: Infinity`) where it makes sense.

---

## Code map (index.html)

| Area | Key names |
|---|---|
| Save (localStorage) | `S`. `S.lv` = upgrade levels, `S.rs` = research tiers, `S.rp` = Research Points, `S.set` = settings (gfx, dayNight, startWave, speed…), `S.mg`/`S.ms` = medals. `S.map`/`S.maps` = campaign theaters (see "Campaign core"): `S.lv`, `S.bank`, `S.best`, `S.set.startWave` are the ACTIVE theater's |
| Campaign | `MAPS`, `switchMap(id)`, `campInit`, `campHold`, `mapCur()`, `MAPM`, `careerBest()`, `rsBest()`, `mapHooks`. UI: `renderTheater`, `openTheaters`, `openThWin` |
| Upgrades | table `U` (`id, need, wave, max, cost, g, cat`). Helpers: `L(id)`, `lockWhy(u)`, `costOf(u,l)` |
| Research | `RLINES`, `rTier(id)`, `rMult`, `rSig`, `rsOwned`, `rsWhy`, `rsDone`, `rsReady` |
| RP economy | `rpWave(w)` (0 before wave 10, then +1 per 10 waves, bonus on multiples of 10). `RP_COST=[0,10,25,50,90,150,240,380,580,850]`. Record bonus +1 only when w>=10. Medals give `rpGain(3)`. Veteran back-pay `min(150,best+3*medals)` |
| Graphics | presets via `S.set.gfx`, `GFX`, `hiGfx()`. Baked sprite cache: `hqBake`/`hqDraw` (tier keys end in `_tN`) |
| Day/night + shadows | `G.todT`, `SH` (len/alpha), `hqShadow`. Vehicles have headlights at night |
| Renderer | ChaosGL: instanced WebGL with a Canvas2D fallback |
| Layout | `fortHalf`, `wallThick`, `wireOut`, `laneHalf(k)`, `driveLane`, `placeSquad`; scale table `US` |
| Camera | Portrait fill factor `pf` in the scale calc. Pinch/wheel zoom `G.uZoom` (1–4) |
| Menus | `homeView` (base/armory/rd/medals) → `renderHome` → `renderBase` / `renderArmory` / `renderResearch` / `renderAAR` |
| Battle HUD | `drawHud`, layout object `HL` (modes `port`/`land`/`desk`), `hudPanel()` (legacy alias `panel()`), `drawRepairHud`, `coachPlace`, `#intel`, `#armChip` |
| Repair | Motor pool (vehicles) and hangar (aircraft) repair facilities |
| Audio | `audioFrame()` is wrapped in try/catch in the frame loop. Cricket gains are `nk*0.6` / `nk*0.42` (turned down on request) |
| Obstacles / pathfinding | `C.solids` (theater layout), `baseFoot`, `_pf`, `pfSync`, `pfStep`, `pfPush`, `pfSnap`, `eHd` (see "Obstacles & pathfinding") |
| Errors | The first `<script>` installs an on-screen error box `#errbox`. A screenshot of it from the user's phone is the fastest way to debug a device crash |

---

## Testing workflow

1. **Syntax:** extract the main script (from the second `<script>` to the last `</script>`) into a .js file and run `node --check` on it.
2. **Headless smoke tests:**
   - Copy index.html to a temp file.
   - Inject a `<script>` before `</body>`. It seeds `localStorage`, starts a run, waits, then writes the results into `document.title`.
   - Run it headless:
     ```
     "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --autoplay-policy=no-user-gesture-required --virtual-time-budget=60000 --dump-dom file:///C:/path/test.html
     ```
   - Grep the `<title>` from the dumped DOM.
   - Standard checks:
     - **All-maxed save:** audio on, must reach wave ~40+, `errbox:false`.
     - **Fresh save:** enemies must actually attack (hp drops, run ends).
   - Don't name a variable `R` in injected code; it clashes with the game. No literal newlines inside injected JS strings.
3. **Phone sizes:** headless Edge can't go below ~500px wide, so use an iframe wrapper at 390×844, 844×390 and 375×667. The harness is `build.py` + `run.py` in the session scratchpad `ui\review-phone\`, which may be gone; if so, rebuild it.
   - Set `PYTHONIOENCODING=utf-8` when printing from Python on Windows.
4. **Owner decision check:** after any UI change, confirm picks and nextUnl are hidden, the AAR is gold, the Armory shows only available items, and R&D shows only visible lines.
5. Nothing has been tested on a **real iPhone** recently. Ask the owner to try it (close and reopen the home-screen app to get updates).

## Agent/merge workflow that worked

- Spawn agents with `isolation: "worktree"` and `model: "opus"`. The session's working directory **must be inside the repo**, or worktree creation fails with "not in a git repository".
- Give agents a time box and tell them to commit often. Long review/workflow loops stalled for hours before.
- Merge each branch, resolve conflicts, run syntax + smoke tests, push, then `git worktree remove -f -f <path>`.
- Watch for **duplicate top-level function names** across agent branches (it happened with `fbm`, `hqMuzzle`, `sstep`), and for references to functions another agent never finished writing.

---

## Recent history (this session)

- Performance pass (ChaosGL + sim + canvas tracks) cut frame times 40–80%.
- Repair facilities: motor pool for vehicles, hangar for aircraft.
- UI overhaul: new home views, battle HUD with the `HL` layout, gold AAR.
- Crash fix: the enemy-armor engine audio got NaN from an `undefined` count, which froze the game on phone. Fixed, and `audioFrame` is now guarded.
- Research Points rebalanced to be much slower.
- Shadows made longer and darker so they're visible at midday. Portrait fill zooms in on tall screens.
- Phone/landscape pass: 20 of 21 findings fixed. Commits `0af4ea2` (HUD), `f044da0` (menus), `cb7d790` (R&D stepper). Changes:
  - Motor pool/hangar is a pill in portrait and sits in the side column in landscape.
  - Coach tips respect the buttons and safe areas.
  - Intel cards show 3 lines for 5.5s, let taps pass through, and have a 44px ×.
  - Landscape Armory/Medals use 2 columns.
  - Pause is a bottom sheet with Resume last.
  - Settings/How-to close by swiping down.
  - 44px tap targets and 11px minimum text.
- Landscape simply follows the phone's rotation / rotation lock. iOS web apps can't force an orientation.

## Improvement loop (2026-09-25) — first 9 commits pushed at 0479cf1; now push every 7 new things
- Test harness: `smoke.py` in the session scratchpad `t\` (syntax + headless Edge that steps `update()` directly, since rAF/blur stall in headless). Modes `maxed`, `fresh`, `mid#<seed>` (random mid-progress saves); `all` runs 5. Env `EXTRA` injects instrumentation JS, `window.XT()` adds to the result line.
- `8d0daed` MANPADS teams + aircraft flares (backlog "gunship flares vs AA"). `ET.manpads`, `EFIRE.manpads`, `flares()`, `samTick`/`samHit`, eshot kind `'sam'`. Spawns only from wave 14 when `flyingCraft()`. Flares recycle every `FLARE_CD`=5s (80% spoof, helis 65%).
- `7f6aea4` Clear Skies medal (50 MANPADS kills, stat `manpads`, bumped in kill()).
- `0f62f41` Medal ranks (backlog 'medal tiers'): `tiers:[g2,g3]` on 11 medals, `S.mt` = ranks past the first, `medalPts()` drives +% cash and the nav dot. Ranks pay `TIER_CASH` x3/x8 cash, no RP.
- `9647c7e` Ranked medal card layout fixed for 390px (checked via iframe phone wrapper `phone.html` in scratchpad `t`).
- `0009119` Flare sfx (`sfx('flare')`, SFX_GAP 0.25).
- `2217d3a` MANPADS tone-down (missile x5, FLARE_CD 4). Mid#7 heli losses: 12 with MANPADS (8 by them) vs 10 without, so they mostly replace RPG kills.
- `9767ce2` Artillery Barrage event (`EVENTS.barrage`, evWeights/evStart/evSting branches) + Counter-Battery medal. Covers backlog 'more mortar work'. Owner-decision screenshots (base/armory/rd/aar) checked OK this pass.
- Perf baseline (no change needed): maxed save, wave ~63, headless Edge software canvas, warm sprite cache → update 0.3ms, draw 4.4ms/frame, ~1 hqBake miss per 300 frames. Probe = `perf3.html` pattern in scratchpad `t` (run the probe synchronously in an inline script; `--dump-dom` doesn't wait for timers without a virtual-time budget, and virtual time freezes `performance.now`). Warm the cache with draws before timing, or cold-cache bakes look like a hotspot.
- `826bdd1` Aircrew Countermeasures directive (`PERKS` id `aircrew`; FLARE_CD/(1+pk), spoof +0.1*pk cap 0.95). Mid#7: missile hits 15 → 9 when taken at wave 20. Heli losses in mid saves come from under-levelled helis vs wave-scaled damage, not a bug.
- `0479cf1` Directive card copy trimmed to 2 lines at 390px (`phone_perk.html` in scratchpad forces a chosen perk trio by swapping PERKS contents around offerPerks()).
- Fuzz pass: mid seeds 5/13/31/57/77/123 clean (no errors/warnings). Seeds that stop near wave 23 aren't stalled; low-vision forts just take ~55s per wave.
- [PUSHED through 0479cf1]
- `eb2d600` (1/7 toward next push) Radar counter-battery: `cbTrack()` adds 0.5s/level (cap 3s) to mortar/MLRS `e.rev`; radar card value shortened (`+84m air · +18% AA · +1.5s track`).
- `b6652d7` (2/7) Drone Swarm event (`EVENTS.swarm`, evStart spawns 2 lead drones via spawnSky, evWeights drone x4) + Swatter medal (stat `swarm`).
- `25183a4` (3/7) Intel crate (`CRATE.intel`, `INTEL_T`=6s reveal via e.rev, crateKind r>0.9 from wave 10).
- `64e6ed3` (4/7) Counter-Battery Fire directive (`cbfire`): mortar/MLRS damage to fort -9% (mid#7) and -20% (mid#42) with forced barrages.
- `3183160` (5/7) **Late-game balance pass (owner playtest request)**: `fortPress(w)` = (waveHp/waveDmg)(w) ÷ same at FP_W=25, ^FP_EXP=1, applied in damageFort; WALL_SOFT 0.95 past WALL_KNEE 12; wall research muls 1/1.3/1.7/2.2/2.8/3.4/4; wall armor 5%/lvl cap 50% (max 10); repairAt cap 1.3%/s; REPAIR_HOLD 3s pause for Engineers + Nanocrete regen; VEH_THIN 0.965/wave from 15; BOMB_PCT 6% max HP to veh/boss per bomb. Also fixed wave stall: vehEnemy now requires visible(e). Tools: `wstats.py <save.b64> <wave> [n]` per-wave stats; saves `botsave_18.b64` (strong), `defsave.b64` (offense x0.75), `weaksave.b64` (x0.6).
- `6fe21ab` (6/7) Anti-Armor Teams directive (`antiarmor`, +35%/rank vs veh/boss in hurtEnemy). Mid#7 reached w42 vs w40 without.
- `3388fd6` (7/7) Walls Under Fire field report (`ev_wallhold`) + evPreview art for barrage/swarm/wallhold.
- [PUSHED through 3388fd6 — next count starts at 1]
- `7a1ee7e` (1/7) Straggler marking (`stragglers()`, STRAG_T 15s, `G.lkT` = last kill time). Never fires in normal smoke runs; verified on a frozen hidden marksman.
- `b0d1abf` (2/7) VBIED car bombs: technical variant via `makeVbied(e)` (VBIED_W 16, VBIED_P 0.2), bomb=3x sapper dmg, detonates in kill(); beacon drawn in drawEShots; `ev_vbied` card. Staged test: one VBIED took 37% off Lv6 walls at w20.
- `74397d1` (3/7) Bomb Squad medal (stat `vbied`, bumped in kill()).
- `9061418` (4/7) Air Support crate (`CRATE.strike`, crateKind r>0.82 from w8; callAir with G.airT/airArmed restored).
- `4722e20` (5/7) Suicide Convoy event (`EVENTS.convoy`, 3 lead VBIEDs, VBIED chance 0.5 during it).
- `bd2ff64` (6/7) Vehicle Barriers directive (`barriers`): VBIED wall dmg x0.5^rank (62%→31% staged at w20), veh -20% speed within wireR+40.
- `7bcb515` (7/7) Roadblock medal (stat `convoy`).
- [PUSHED through 7bcb515 — next count starts at 1]
- `ce95a42` (1/7) Field Manual tips updated (events list, crate colours, repair pause).
- Fuzz after balance+VBIED: mid seeds 3/11/19/29/64/88 all clean, every run ends by defeat at w32-47 (no stalls).
- `9d75009` (2/7) NEW RECORD feed + fanfare when G.wave hits startBest+1.
- `135bcf7` (3/7) Last Stand (`G.lastStand`, rapidT 10s on first breach).
- `92455f7` (4/7) Holdout medal (`G.brHeld` counted in rpClear when walls are down; medalMax 'holdout') + crate control hint text.
- `b49c17e` (5/7) Sapper Teams directive (`sappers`): repairHold()=3s/(1+rank), repair x(1+0.5*rank). +10% wall: 13.0s → 8.2s.
- `5c3dd4e` (6/7) AAR threat 'vbied' (`threatName()`, COUNTER.vbied).
- `713233e` (7/7) Car-bomb horn on first sight (`e.vsn`, `G.vbHorn` 1.2s limit).
- [PUSHED through 713233e — next count starts at 1]
- `397b4bc` (1/7) stragglers() counts/reveals G.sky too; updateSky now decrements e.rev (it never did).
- `9aaf633` (2/7) Wave medals Unbroken (75) + Legend of the Fort (100).
- `b65ab30` (3/7) Ambush event (`EVENTS.ambush`, 30% of spawnLeft placed at 0.85*sight on one flank). Perf recheck: draw 4.2ms / update 0.3ms (unchanged).
- `289afe7` (4/7) Flank Guard medal (stat `ambush`) + tips list.
- `26b71fe` (5/7) Save backup/restore (#bakBtn, #bakIn, #bakRestore; code = 'FORT1:'+base64 JSON). Clipboard failure falls back to filling the box. Input 16px so iOS doesn't zoom.
- `c0f70f3` (6/7) Low-gfx strike crate glyph 'A'. Low-gfx render of new content checked (note: grepping dump-dom for 'errbox' matches the reporter's own source; use getElementById).
- `4755479` (7/7) One-time backup tip toast (S.set.bakTip) when best >= 15.
- [PUSHED through 4755479 — next count starts at 1]
- `e9b05a1` (1/7) armorCallout() INCOMING roster feed (skips waves of ≤2 technicals). Bot recheck with all new content: w29@r10, w58@r15, w70@r16, all runs end by defeat. Harness gotcha: don't name injected globals FC/HL/R (game globals).
- `f64e64b` (2/7) threatK: vbied 0.12 (top THREATS priority).
- `5ca20c7` (3/7) vbiedBlast() wall-hit FX.
- `5bb7856` (4/7) Resupply Drop event (`EVENTS.resupply`, dropCrate ammo/fix/strike). Anchor gotcha: evStart and evSting both contain 'else if(k===...)' lines; anchor on the body text.
- `7ad720e` (5/7) AAR Run details: EVENTS REPELLED chips (`G.evDone` via evClear, `lastAAR.evs`). Event-combo fuzz (random event every eligible wave, seeds 5/17/33/71): all 9 events fired, clean.
- `6ebd8bb` (6/7) Scrounger medal (stat `crates`, bumped in grabCrate for non-cash).
- `b5381c4` (7/7) EVENTS.good flag → COMPLETE wording; AAR 'EVENTS CLEARED'.
- [PUSHED through b5381c4 — next count starts at 1]
- `b02b259` (1/7) Combat Mechanic (grunt variant e.mech, e.mechOf vehicle; mechTick follows + heals MECH_HEAL 3%/s within MECH_R 70; MECH_P 0.3 of vehicles from MECH_W 20; ev_mech card). Landscape HUD checked with new callouts: OK.
- `958f984` (2/7) Wrench Breaker medal (stat `mech`).
- `86e5833` (3/7) Walls HUD label tint (amber paused / green repairing).
- `696b097` (4/7) **Owner request**: day 2x / night 1.25x longer. DAY_LEN/NIGHT_LEN, todAdvance(h0,waves) piecewise clock (06-18 day rate). Verified: day 9.00 waves, night 5.62 per cycle.
- `74f05a7` (5/7) Illumination Rounds directive (`illum`, removes NIGHT_CUT in sight(); single rank).
- `98d23d5` (6/7) Night Owl medal (stat `night`, rpClear when nightK>0.5).
- `0106712` (7/7) Armor tip mentions mechanics.
- [PUSHED through 0106712 — next count starts at 1]
- `af24651` (1/7) Medal roll-out (`from:` wave on 24 medals, renderMedals shows unearned only when S.best>=from; earned always shown). Best 5 → 10 cards, best 30 → 26.
- `93c7d80` (2/7) Tip roll-out (tipGate in manualHtml; base manual rebuilds when its HTML changes, was fill-once). best 0→2 tips, 7→4, 30+Engineers→6.
- `d1e80c4` (3/7) Mechanic heal cap (o.mhT/o.mhBy one healer per vehicle per tick, MECH_HEAL 0.02). Gotcha: many functions are one-liners; never append a // comment mid-line in an edit, it comments out the rest.
- `6c240d7` (4/7) VBIED drums overlay (drawEShots, along e.face).
- `44f0a30` (5/7) ev_night field report (queued in dayTick when nightK>0.6).
- `b6308a5` (6/7) S.set.callouts toggle (#sCall) gating armorCallout / ambush CONTACT / stragglers feed.
- `cfb7908` (7/7) How-to guide Battle Events section (from EVENTS, sorted by from).
- [PUSHED through cfb7908 — LOOP ENDED by owner request]

---

## Open items / next up

1. ~~Phone finding #11~~ **CLOSED (owner, 2026-09-25):** landscape layout is good as is. Do not move the action buttons.
2. ~~Unlocks teasers / R&D numerals~~ **CLOSED (owner, 2026-09-25):** keep the Armory "Unlocks …" lines and the R&D tier numerals as they are. Do not hide them.
3. **Real-device check on iPhone:**
   - swipe-to-close sheets
   - tap-through intel cards
   - bottom-sheet pause
   - landscape layout
4. **Backlog ideas:**
   - medal tiers
   - daily challenge
   - gunship flares vs AA
   - more mortar work (an earlier partial attempt was discarded because it called an undefined `updateMortarShells`)

Always re-run the smoke tests and the owner-decision check before pushing. A push goes live immediately.

**Owner push rule (2026-09-25): push to main after every 7 new things added** (count starts after the push of `0479cf1`). Run smoke tests + owner-decision check first.

## Graphics + ChaosGL perf workflows (2026-09-26) — PUSHED at 2c20fc7
- Perf (owner goal: steady 30-40fps at 2.5-3x from wave 25 on iPhone 16 Pro). Root cause: GPU fill/sync (night lighting multiply/screen passes, DPR 3, canvas read-backs), not sim.
  - Merged perf-sim (sim -15..23%, seeded state hashes identical to main), perf-fx (cached smoke/decal sprites, zero-alloc getters), perf-render (PHONE_DPR=2 cap, phone lighting in one 1/5-res source-over pass, no read-back passes on phones, star/lamp sprites).
  - ONE adaptive-quality governor: render half owns AQ.lv (aqTick: ema/hitch/GL-trial/resolution ladder, phones only); FX half is aqFxApply() (caps scale by AQ_Q[lv]); aqApply() calls both. AQ.force pins a level for QA.
  - Measured (perfwave.py, weak save lvscale 0.6, 430x932@3x, seed 12345): w50 High p95 45→5.2ms, avg 9.7→5.0; w25 High p95 26→5.3; w25 Medium avg 5.1→2.9. Laptop GPU, not iPhone.
  - Profiler: scratchpad t\perfwave.py (+perfwave_tpl.html); see its header for options (--noprof --seed --lvscale --stub --patch --json).
- Graphics: audit of ~100 assets; merged 12 reviewed upgrades: aircraft HQ pass (gunship/bomber, drone/UAV), SAM+MLRS+RPG+mortar round sprites, air-burst FX, crates (per-kind strap/glyph + badge), radar, motor pool, barbed wire tiers, low-gfx airstrike plane, mechanic wrench badge + toolbox, VBIED baked sprite (gfx-3 version, 7px label).
  - gfx-3 842048d merged later with fixes (heli keeps e.col base, rotor 1.25w/62% alpha): pushed.
- Workflow lesson: agents running a single >3min command get killed as "stalled"; tell them to run smoke modes one per command / background long jobs.

## Missiles + gunship weapons (2026-09-26) — PUSHED at 3d06308
- Real missile flight model: mslNew(kind,...) / mslFly (boost → PN steering with turn-rate limit, altitude via z, distance-spaced smoke trails), kinds table MK (jav, stg, spk, jagm, sw, hyp, tow, hf, grf, sam0..sam4, ...). Launcher blasts 52-82 radius with falloff to 35%; per-tier damage trims keep volley totals near the old values.
- Launcher tiers: Javelin top-attack (Stinger vs air), Spike NLOS heavy lofted anti-armor, JAGM 4-missile ripple, Switchblade loiter-then-dive, Hypersonic streak. SAM/fighter/silo/ATGM racks/enemy heli+jet rockets all use the same system (ATGM_K/ATGM_Z per rack).
- Gunship: gsFire/gsStart/gsShot rotation 25mm minigun (infantry) → 30mm (light vehicles/groups) → 105mm (held for armor: boss>MBT>MLRS>IFV>APC, infantry only after 6s/3s with no armor) → Griffin volley (Block 30). Laser tier swaps the 25mm for a sweeping beam; Arsenal = 6-shell 105mm barrage; Wing = second gunship avoiding the first's targets. Enemy airboss alternates 25mm/40mm.
- Merge note: gunship Griffins must be created with mslNew('grf',...) (old {vx,vy,...} objects crash mslFly).

## Campaign core (phase 1, branch `campaign-core`)
The game is now a campaign of 8 theaters. Holding (clearing) wave 100 on a theater opens the next; a cleared theater stays playable forever. Code: `// ================= CAMPAIGN =================` right after `save()` in the SAVE section, `// ---------------- THEATERS ----------------` in the BASE UI section, `campHold` next to the medal toasts.

**Owner decisions (fixed):** cash, Armory levels, best wave and the checkpoint start are PER THEATER (each theater is a fresh fort build). R&D (`S.rs`/`S.rf`/`S.rp`), medals (`S.mg`/`S.ms`/`S.mt`), settings and lifetime stats stay account-wide. Stars: 1 = wave 50, 2 = wave 100, 3 = wave 100 with the walls never breached in that run.

### Save model
- `S.map` = active theater id (`'desert'` … `'capital'`).
- `S.maps[id]` exists for all 8 theaters: `{stars 0-3, cleared bool, visited 1?}`. For every theater that is NOT active it also holds `{lv, bank, best, startWave}`.
- The ACTIVE theater's `lv`/`bank`/`best` live on `S` and its checkpoint lives on `S.set.startWave`, exactly where all existing code reads them (`L(id)`, `S.bank`, `S.best`, `startWaveOk()`), so nothing else had to change. Invariant: `S.maps[S.map]` never holds `lv/bank/best/startWave`.
- `S.campWin` = id of a theater cleared for the first time whose Base debrief has not been shown yet (set mid-run, cleared when the debrief closes).
- `campInit()` (end of `loadSave`) normalises all of this. A pre-campaign save (no `S.map`) becomes Desert Outpost with its current fort, cash, best and checkpoint; stars it already earned are credited from its best (`heldStars`: best is the wave REACHED, so best > 50 = 1 star, best > 100 = 2 stars + cleared). 3 stars need a tracked run, so old saves top out at 2. It also self-heals stars/cleared from each theater's best.
- Unlock rule: `mapOpen(id)` = theater 1 always; theater k when theater k-1 is `cleared`. Computed, never stored.
- FORT1 backup codes are `JSON(S)`, so they carry `map`/`maps`; restoring an old code runs the same migration. RESET wipes the campaign too.

### switchMap(id) — the one place a theater changes
Refuses while `running`, for unknown/locked ids and for the active id. Otherwise: `save()`, park `S.lv/S.bank/S.best/S.set.startWave` in `S.maps[old]`, move `S.maps[id]`'s in, `S.map=id`, `mapSync()` (multipliers), reset caches derived from the old fort (`_armFreeze`, `_fpW`, `_manSet`, the in-memory AAR `lastAAR/lastRunMsg/lastCause`), run every `mapHooks` entry `f(id)`, `save()`, `idleBake()` (High terrain/fog/fort rebake off the frame loop) and `renderHome()`. The terrain cache needs no reset: `terrainBake`'s key includes the theater id.

### MAPS table fields
`id, ord (1-8), name, blurb` + theme fields for the theming phase (all placeholders except Desert Outpost, marked TODO-theme / TODO-tune):
- `ground {lush,dry,dirt,mud,scorch}` = terrain macro palette (was the `GR` const), `seed` = terrain layout seed (Desert 20240 = the original), `lo [fill, decalA, decalB]` = Medium/Low ground colours.
- `twist` = theater mechanic id, read via `mapTwist()`; NOTHING consumes it yet.
- `mix {enemyType: weightMul}` = applied in `pickType` by `mapMix(p)` after `evWeights` (infantry/sky types only; vehicles come from `VEH_WAVE`). `null` = untouched.
- `ev {eventId: weight}` = weighted pick in `rollEvent` (unlisted events weigh 1). `null` = the original uniform pick, same RNG draws.
- `hpMul/dmgMul/rewMul` = multiplied into `waveHp/waveDmg/waveRew` through `MAPM`. Desert = exactly 1. Theaters 2-8 use `MAP_DIF(i)` = 1.9^i / 1.6^i / 1.8^i (placeholder). `fortPress` is a ratio, so it is unaffected; medal cash (`medalCash` → `waveRew`) scales with the theater.
- Desert Outpost parity is verified bit for bit against main: wave curves (w 1-400), the baked High terrain pixels, and a seeded 700 s simulation (Math.random seeded before the main script, `sfx`/`tone` stubbed, directive picks forced) end in identical state.

### Stars and the clear moment
`campHold(w)` runs in the wave-clear branch of `update()` (right after `medalMax('wave',…)`; the line saves right after). Stars count waves HELD, like the wave medals: w >= 50 → 1, w >= 100 → 2 + `cleared` + `S.campWin`, and 3 when `!G.lastStand` (no breach this run), the fort had walls, and the run deployed below wave 100 (a W100 checkpoint cannot farm the 3rd star). A new star rides the medal toast lane (`medalToast({html})`, "THEATER STAR"). The first clear also fires a `THEATER CLEARED / <NEXT> UNLOCKED` battle banner + fanfare, and back on Base `openThWin()` shows the gold debrief (stars, the unlocked theater, what carries over) with MOVE OUT (switches) / STAY.

### UI (owner roll-out respected)
- Mission Briefing gets one `#theater` bar under its header. While only theater 1 is open it is just the name + stars (`.thb.one`). From 2 open theaters it becomes a selector: emblem (tinted from the theater's ground palette), "Theater n of 8 · best wave", stars, CHANGE (+ green dot while an opened theater is unvisited).
- `#thList` sheet (same shell as Settings: swipe-down, Esc, backdrop): open theaters as cards (DEPLOYED / CLEARED / NEW), the next locked one with its blurb and a "Clear wave 100 on <prev> to unlock" progress chip, the rest as one-line locked teasers.
- Checked at 390x844, 375x667, 844x390 and 1280 desktop. Picks/Next Unlocks stay removed, AAR stays gold.

### Account-wide vs per-theater reads of "best"
- Per theater (`S.best`): Armory `u.wave` gates, checkpoints, NEW RECORD, RP record bonus (+1 past the theater's best), medal cash scale, pause BEST, Base BEST tile.
- Career (`careerBest()` = max over theaters): medal roll-out `from`, wave-medal sync, Field Manual tips/open state, first-deployment card, RP hint, service record, backup tip.
- R&D wave gates read `rsBest()` (currently `careerBest()`).

### Hooks for the next phases
- **Phase 2 (theming):** DONE on branch `maps-themes`, see "Theater themes and twists" below.
- **Phase 3 (R&D by theater, timers, gems):** change `rsBest()` (one line) to per-theater gates; new account-wide state (timers, gems) goes on `S` directly, new per-theater state goes in `MAP_KEYS` (auto-swapped) or `S.maps[id]` meta.
- **Phase 4 (economy/dailies/ads):** retune `MAP_DIF`, `rpWave`/`rpClear` (record bonus is per theater now, so a new theater pays record RP again), `medalCash`. Star/clear events are centralised in `campHold` if missions or rewards need to hang off them.

## Theater themes and twists (phase 2, branch `maps-themes`)
Desert Outpost is untouched: it has no `TLOOK` entry and gets `TW0` (identity knobs), so its terrain pixels, spawns and a seeded 700 s sim match campaign-core bit for bit (`.qa/t_ter.js`, `.qa/t_par.js`). Difficulty (`hpMul/dmgMul/rewMul`, `MAP_DIF`) is NOT touched here (phase 3 owns it).

### Gameplay: `TWS` + `tw()` (CAMPAIGN section, right after `mapTwist`)
`tw()` returns the active theater's knobs (cached per `S.map`; Desert = `TW0`). Knobs: `sk` ground sight x (City 0.86, Jungle 0.82, applied in `sight()`), `nk` night-cut x (Island 1.5 = 22.5%), `arc` ground spawn arcs (`twSpawnA` maps the existing uniform angle onto the arcs, no extra RNG draws), `lc` landing craft, `bliz` + `slow` blizzards, `night` permanent night, `veh` vehicle roster multipliers (`vehWave`), `mechW/mechP`, `vbW/vbP` (spawn), `boss2` second MBT on boss waves.
- **Mountain Pass (`ridges`)**: ground spawns only down the N and S passes (+-0.42 rad). Mix mortar 1.8 / shooter 1.6; events barrage 2.5, no sandstorms.
- **Coastal Base (`landing`)**: sea to the east (`seaIn(x,y)` = distance past the waterline; `shoreD()` keeps it out past fort + wire + a beach). Infantry spawn on the land arc; APC/IFV take the sea arc 45% of the time (`e.amph`, wake while swimming). `lcWave()` sends 1-4 landing craft per wave from wave 2 (`e.lc` 1 inbound / 2 grounded / 3 backing off; `lcTick`), each carrying 4-6 of the wave's troopers; sunk before grounding = the squad never lands (carrier bonus). Boats back off and despawn (no bounty). `landPt()` keeps crates, mines and paratroopers out of the surf; ambush flanks never open from the sea (`twLandA`).
- **City Ruins (`urban`)**: sight x0.86, technicals x1.8, combat mechanics from wave 12 at 55%, ambush weight 3.
- **Arctic Station (`whiteout`)**: `bzTick` blizzards from wave 3 while a wave is live: every 45-70 s for 16-22 s, driving `G.fogK` (sight -27%, white veil via `TLOOK.arctic.storm`) and slowing enemy ground movement by up to 30% (`twS` in the enemy loop). APC/IFV/MBT rosters x1.3-1.5. No sandstorm event.
- **Jungle Airstrip (`canopy`)**: sight x0.82, drones x1.8 / gunships x1.6, ambush 2.5, swarm 2.2.
- **Island Night-Ops (`nightops`)**: `dnWant()` forces day/night on; `dayTick` rocks the clock between 21:36 and 02:24; moonlight lifted ~20% (`dayFrame`); night cut 22.5%. Paradrops 2.6, convoys 2.4, car bombs from wave 10 at 35%. `offerPerks` swaps Illumination Rounds into an offer 50% of the time. Sea to the SW (same shoreline code).
- **Capital Defense (`capital`)**: rosters x1.3, armored column 2.6, heavy air mix, a second 60%-HP MBT on boss waves from wave 20.
- FIELD REPORT cards `ev_th_<id>` (and `ev_lc`) queue 1.5 s into the first run on a theater (`twTick`); previews are a mini-map of the theater (`thPreview`) / the boat (`lcPreview`).

### Look: `TLOOK` (THEATER THEMES section, before `bakeWire`)
Per theater: `geo(C)` layout (ridges, streets/blocks, runway, canopy mask, smoke sites) shared by the bake, Medium/Low and the plumes via `tGeo(id,V,keep)`; `macro(C)` per-pixel hook in `terrainBake`'s colour field (hill-shaded ridge relief with snow, sea/beach, streets, drifts/ice, canopy shade, lava, plaza); `bake(C)` props (`tProps` gives `spot/cnt/take` with a spatial hash); `tufts` palette (`tuftSprites(TC)`); `grade` colours; `lo(C)` Medium/Low paths (`drawLoFeatures`); `storm`, `precip` (`drawPrecip`: snow/ash), `plumes` (`drawPlumes`: smoke columns over burning blocks), `surf` (`drawSurf`), `cloud` tint and `mist` (`drawAtmos`). New props: pine, palm, broadleaf crown, radar dome, hut, flat roof, ruin, rubble, car, jersey barrier, bunker, monuments, drift, pier, boat, plane wreck. `propRock` takes a palette and returns its outline.

### UI
- Battle HUD: `hudTheater()` prints the theater name (map glyph, small dim caps) under the status panel in every layout; on phones it yields to the pills row.
- Emblems: `TH_SKY` + `TH_ART` (48x48 silhouettes), number as a corner tab; open cards carry the scene as a watermark (`thArt`) and a one-line twist tag (`TW_TAG`); locked tiles stay neutral.

### QA (`.qa/`, gitignored)
`t_ter.js` (terrain hash), `t_par.js` (PRE=pre_seed.js, seeded parity), `t_core.js` (campaign core; its ev/mix expectations were updated to the phase-2 data), `t_tw.js` (twists, PRE=pre_seed.js), `t_view.js` (full baked terrain, `#<id>` / `#<id>-lo`), `t_bat.js` (battle shots `#id~gfx~hour|off~secs~wave~bz`), `t_list.js`, `t_card.js`, `smoke.py` (+ `MAP=<id>`), `smoke_maps.py`, `perf_maps.py`.

## Obstacles & pathfinding (branch `city-paths`)
Owner request: tanks and soldiers must not walk through standing buildings. Code: `// ================= OBSTACLES & PATHFINDING =================` (sim section, right before `callAir`) plus the layout parts in THEATER THEMES.
- **What blocks** = `C.solids` of the theater layout (`tGeo`): oriented rects `{x,y,hw,hh,rot}` or discs `{x,y,r}`, pushed by `sRect`/`sDisc` in each theater's `geo(C)`. City: intact buildings (lot kind 1; set 4 in from the lot so a tank fits down every street); Capital: standing government blocks (`b[4]`) and the 4 monuments; Arctic: radar dome + two prefabs per station, lone huts; Island: pillboxes; Jungle: the crashed transport (fuselage, wings, tail). Ruins, rubble, cars, barriers, sandbags, trees stay passable. Desert/Mountain/Coastal have none.
- **Same layout as the art**: which lots stand is seeded per block in `geo` (not by the bake's RNG stream), so the High bake, Medium/Low (`lo()` now draws standing buildings/monuments/huts/bunkers/wreck as solid shapes; the many City/Capital roofs go through `loRects`, filled rect by rect and only in view by `loDraw`, because extra whole-map path passes cost ~1 ms on Medium) and the pathfinder agree. `TLOOK[].foot` theaters also key their layout on `tFootK()` (upgrade levels that move base structures): `baseFoot()` = padded boxes of the lanes, fuel dump, depot, outer pads, runway+apron, motor pool, hangar (same formulas as `initLogi`/`mkSite`); a building there becomes a ruin, a prop there is not placed, a monument moves out to the first clear diagonal boulevard crossing (roundabout). So nothing friendly ever sits in a building.
- **Flow field** `_pf` (`pfSync()` at `startRun`, and on a 2 s idle timer at the base; cached per layout object): grid `PF_CS`=12, radius V+160, two layers (`PF_CLR` = 9 infantry / 18 vehicles+boss: solids grown by the clearance). Per cell `st`: 0 = straight line to the fort clear (grown by clearance + `PF_LOS`) -> the original radial step runs unchanged; 1 = shadowed -> steer to `(tx,ty)`, the furthest of the next `PF_LOOK` cells up the Dijkstra path (8-connected, no corner cutting) that is in plain view; 2 = inside a grown solid or a sealed pocket -> `(tx,ty)` = nearest cell with a way out. Build ~40-80 ms at max vision (node, both layers).
- **Hooks** (all return at their first test when `_pf` is null, which is how Desert stays bit-identical): `pfStep` in the enemy loop / `standOff` / `depotEnemy` / `siteEnemy` / `mechTick` (the last three only when their straight line is blocked, `pfBlocked`); `pfPush` after `separate()` (walks anything shoved into a clearance back out, eases `e.hd` back to facing the fort); `pfSnap` in `spawn()` (every ground spawn: waves, ambush, paradrops, dismounts, mechanics), `dropCrate`, `layMines`, and aircraft crash sites; `pfTrail` routes recovery crews (`fcRoute`) around buildings.
- **Heading**: `e.hd` (undefined = face the fort) is the hull heading while the field steers; draws use `eHd(e,x,y)`, MBT turrets keep facing the fort.
- **Stuck watch**: in a shadowed cell, no path progress (`g` down by 6) for `PF_STUCK` 2.6 s -> slide sideways for `PF_NUDGE` 0.8 s (`_pfStuck` counts). Standing-off units (mortars, MLRS, ranged vehicles) still stop on their radius as before.
- Measured: Desert terrain hash and the seeded parity sim unchanged; spawn-ring reachability 0 unreachable bearings on every theater/save; no enemy inside a solid over 120-150 s sims (vehicles keep >= r-2 px); seeded A/B vs campaign (3 seeds, City/Capital, maxed w60 and mid w20): same waves reached and deaths; per-frame field cost ~15 us for 120 enemies (node bench `pfbench.js`), perfwave w50 within noise.
- Not done: buildings collapsing under heavy fire (would need a terrain texture re-upload and a field rebuild mid-run; skipped for iPhone frame budget).
- QA: `.qa/t_path.js` (`HASH=#<map>~<fresh|mid|maxed>~<secs>~<wave>`: build stats, spawn-ring reachability for both layers, sim with enemies-inside-solid / vehicle clearance / stuck counts), `path_all.py` (all theaters x saves), `t_jam.js` (48-unit column dropped at the worst detour), `t_flow.js` (street-flow battle shots, `~inf`/`~veh` injects a flow-field overlay), `pfnode.js` (wall-clock field build on dumped solids, `t_dumpsol.js`).
