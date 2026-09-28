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
4. Weapons shouldn't feel like "needles". Since phase 3 every Armory line is capped per theater (`CAPS`, see "R&D economy"): the caps grow a few levels per theater instead of being endless.

---

## Code map (index.html)

| Area | Key names |
|---|---|
| Save (localStorage) | `S`. `S.lv` = upgrade levels, `S.rs` = research tiers, `S.rp` = Research Points, `S.set` = settings (gfx, dayNight, startWave, speed…), `S.mg`/`S.ms` = medals. `S.map`/`S.maps` = campaign theaters (see "Campaign core"): `S.lv`, `S.bank`, `S.best`, `S.set.startWave` are the ACTIVE theater's |
| Campaign | `MAPS`, `switchMap(id)`, `campInit`, `campHold`, `mapCur()`, `MAPM`, `careerBest()`, `rsBest()`, `mapHooks`. UI: `renderTheater`, `openTheaters`, `openThWin` |
| Upgrades | table `U` (`id, need, wave, max, cost, g, cat`). Helpers: `L(id)`, `lockWhy(u)`, `costOf(u,l)` |
| Research | `RLINES` (`lines` + ride-along `ride`: the squad rides on Infantry Kit `dmg`), `rTier(id)`, `rMult`, `rSig`, `rsOwned`, `rsWhy`, `rsDone`, `rsReady`, `rsOpenNext`. Gates `RS_GATE` + `rsProg()`; prices `RS_RP`/`rsCostAt`; lab times `RS_MIN`/`rsMinAt`; what a tier costs on this save `rsPrice`/`rsCost`/`rsMs` |
| Lab + gems | `S.lab`, `labStart`, `labTick`/`labLand`, `labLeft`, `labSkip`, `labSkipCost`, `labBuySlot`, `labUi` (1s ticker). Lab speed-up ad `labAd`/`labAdSt`/`labAdBtn` `S.gems`, `gemAdd(n,src)`, `gemSpend(n,why)`, `GEM_FREE`, `openGems()`. Shop markup `gemHtml()`, one click handler `shopClick` on `#gemBody` (sheet) and `#shop` (STORE view), repaint `gemRefresh()` |
| RP economy | `rpWave(w)` (0 before wave 10, then +1 per 10 waves, bonus on multiples of 10). Tier prices follow the tier's campaign gate (`rsCostAt`). Record bonus +1 only when w>=10. Medals give `rpGain(3)`. Checkpoint back-pay `cpBackPay` (cash + RP, after 5 held waves). Veteran back-pay `min(150,best+3*medals)` |
| Graphics | presets via `S.set.gfx`, `GFX`, `hiGfx()`. Baked sprite cache: `hqBake`/`hqDraw` (tier keys end in `_tN`). Fort look = `fortDes()` (Fort Walls research) via `wallMat`/`wallRise`; Armory levels only size it |
| Day/night + shadows | `G.todT`, `SH` (len/alpha), `hqShadow`. Vehicles have headlights at night |
| Renderer | ChaosGL: instanced WebGL with a Canvas2D fallback |
| Layout | `fortHalf`, `wallThick`, `wireOut`, `laneHalf(k)`, `driveLane`, `placeSquad`; scale table `US` |
| Camera | Portrait fill factor `pf` in the scale calc. Pinch/wheel zoom `G.uZoom` (1–4) |
| Menus | `homeView` (`VIEWS` = base/armory/rd/store, keys 1-4) → `renderHome` → `renderBase` / `renderArmory` / `renderResearch` / `renderStore`; `renderAAR` on Base. Medals are the Base tile `#medTile` (`renderMedTile` → `renderMedals`); `setView('medals')` → `openMedals()` |
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
- R&D gates read `rsProg()` (campaign progress, phase 3; `rsBest()` is gone).

### Hooks for the next phases
- **Phase 2 (theming):** DONE on branch `maps-themes`, see "Theater themes and twists" below.
- **Phase 3 (R&D by theater, timers, gems):** done, see the next section.
- **Phase 4 (economy/dailies/ads):** hang daily missions, ad rewards and IAP on `gemAdd`/`gemSpend` (never sell speed). Star/clear events are centralised in `campHold` if missions or rewards need to hang off them. The shop can grow out of the gems sheet (`gemHtml`/`openGems`).

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

## R&D economy, timers and gems (phase 3, branch `rd-economy`)
The campaign loop is play → die → earn a little RP → start research → repeat, over many runs per theater. Cash/Armory/best/checkpoints are per theater; R&D, RP, gems and medals are account-wide.

### R&D gated by theater (`RS_GATE`, `rsProg()`)
- Campaign progress `rsProg()` = (theater order − 1) × 100 + that theater's best wave (a cleared theater counts 100; only open theaters count). A tier opens when `rsProg() >= t.gate`.
- 100 researchable tiers since the Infantry Kit merge (was 107; see "Infantry Kit and fort design"): Desert Outpost 13 (Rifleman at wave 1 as the tutorial), Mountain 12, Coastal 12, City 13, Arctic 12, Jungle 13, Island 13, Capital 12, spread over waves 3…94 in the order the old wave gates rolled them out (`.qa/gates.js` regenerates the table). Vanguard Commander is last, at Capital Defense wave 94.
- `t.g` (old wave gate) now only picks the tier's era tint. `t.gate`, `t.cost` (RP, `RS_RP` anchors per theater, geometric in between) and `t.ms` (lab time, `RS_MIN` anchors) are filled in at load. `.qa/tiers.js` prints the per-theater table.
- Lock text `gateTxt(g)` ("Reach wave 58 on Mountain Pass"); a tier in a theater not yet open reads "Opens in <theater>".

### Lab (research timers)
- `S.lab = {t, w, slots, q:[{id,k,rf?,t0,end}], news:[…]}`. Starting a tier (`labStart`, UI `buyResearch`) pays its RP and fills a slot; it lands (`labTick`) when `end` passes, even with the app closed. Refits use the lab too (`refitMs`).
- Clock safety: `labNow()` advances the lab clock by positive `Date.now()` deltas only: setting the device clock back never stretches a timer, forward-then-back cannot un-finish a job. The lab clock starts at `Date.now()`, so ends are absolute timestamps unless the clock was ever set back.
- 1 slot; `labBuySlot()` opens the 2nd for `LAB_SLOT_GEMS` (900 gems), teased in the lab strip once Desert Outpost is cleared.
- UI: lab strip at the top of R&D (job, progress bar, countdown; idle slot; 2nd-slot teaser), a RESEARCHING tier card with bar + FINISH NOW (gem price, two-tap confirm; opens the gems sheet when short), the running job on the Base R&D panel, R&D nav dot when research landed (`S.lab.news`, cleared by opening R&D) or the lab is free with an affordable tier. `labUi()` refreshes countdowns every second without re-rendering; `labLand()` toasts landed jobs. A job that lands mid-run deploys next run (the run snapshot is unchanged).

### Gems (premium currency core for phase 4)
- `S.gems`, `gemAdd(n, src)`, `gemSpend(n, why) -> bool` (false and nothing spent when short), lifetime ledger `S.gemT = {in:{src:n}, out:{why:n}}`. Phase 4 credits with its own `src` ('daily', 'ad', 'iap:<sku>') and spends with its own `why`.
- Free sources (`GEM_FREE`): first clear of theater k = 20 + 10k (30…100), stars +5/+5/+10, medals +3 (first award) / +2 (each rank). Old saves get a one-time credit for what they already earned (`gemInit`, `S.gemv`).
- Uses: finish research now, `labSkipCost(ms) = ceil(10 × hours^0.8)` (10 min 3, 1 h 10, 8 h 53, 18 h 101); 2nd lab slot 900. Battle speed is never sold.
- Header gem chip (violet, after RP) opens the gems sheet (`openGems`). RESET keeps gems (they may be bought).

### Armory caps + theater prices
- The 28 formerly endless lines have `max:0` in `U`; `capSync()` (run by `mapSync`) writes `CAPS[id] = [cap in theater 1, + per later theater]` into `u.max`, so every `u.max` reader works unchanged.
- `costOf` multiplies by `MAPM.cost` (= the theater's `rewMul`): every theater's cash loop has the same shape, bigger bounties and bigger bills.

### Theater difficulty ramp (`MAP_DIFT`, `mapMul`)
- Rows `[hpMul, dmgMul, rewMul, hp0, dmg0]`. Enemy HP/damage use hp0/dmg0 up to wave `MAP_W0` (5) and the full value from `MAP_W1` (95), geometric in between: a fresh fort is mostly the commander's research, a finished one is research-boosted units at higher caps. `rewMul` is flat. `fortPress` uses the base curves (`hpBase/dmgBase`). Desert Outpost = exactly 1 (bit parity kept).

#### Retune after the phase-2 twists + pathfinding (branch `difftune`)
Phase 3 was tuned on a build without the twists and without obstacle pathfinding. Both builds (rd-economy `f0f2c7d` = "old", campaign `d27b0cb` + this branch = "new") were run through the same seeded probes (`.qa/pe.js` + `px.py`, Math.random = Park-Miller from the seed; results in `.qa/res*.txt`, summary `.qa/findings.txt`, report `pxrep.py`):
- **cap**: the theater-k fort at its Armory caps with every tier gated <= (k-1)*100+72, deployed at checkpoint 75 until it falls (phase 3's `probe.js`). Death wave, old vs new at the unchanged multipliers: Mountain 92.0 vs 93.3 (n 9/10), Coastal 97.0 vs 96.8 (6/5), City 103.0 vs 103.5 (5/4), Arctic 98.4 vs 98.4 (5/5), Jungle 97.0 vs 97.8 (5/4), Island 97.1 vs 97.2 (8/8), Capital 100.5 vs 98.9 (8/8). Seed spread is ~2-3 waves, so only Mountain (+1.3, easier: pass-only spawns bunch the column) and Capital (-1.6, harder) are outside noise. Capital without `boss2` = 100.5, so the second boss tank is the whole Capital delta.
- **early**: the free campaign bot's real arrival save in each theater (`arr_F_<id>.json`, fresh fort + the research it had), 12 consecutive runs from wave 1 with greedy Armory buys. The mean run-1/4/8/12 waves match old vs new within ~1.5 waves on every theater (e.g. Arctic 6.8/17.0/29.0/36.8 old vs 6.5/18.2/30.2/38.5 new; Island 6.0/14.0/26.2/34.0 vs 6.0/14.0/25.5/33.8), so hp0/dmg0 are unchanged.
- Retuned: Mountain 9 -> 9.5 (probes: 9 = 93.7, 10 = 91.0, 11 = 89.8, target 92.0), Capital 15000 -> 13500 (13500 = 100.5 = old). dmg/rew follow the same curve. Everything else unchanged. Desert untouched (`t_par` identical).
- Campaign check (cbot from the free run F's real arrival, new build, one sample each; same-theater spread is 2.6-7.2 days): Mountain 4.4 days / 56 runs (F: 3.6 / 52), City 4.9 / 63 (FV: 4.6 / 69), Capital 6.4 / 80 (FV at 15000 on the old build: 9.2 / 130; phase 3 saw 5.4-9.6 across variants). Expected days per theater stay about Desert 2.6 · Mountain 3.6-4.4 · Coastal 1.4 · City 4.6-4.9 · Arctic 2.6 · Jungle 10.2 · Island 8.6 · Capital 6.4-9.2, so ~40-43 days for a free player.
- Open: one City run in `cb_FV2_city` stalled (wave 47 never ended, the 7200 s run cap hit; 0 stalls in ~800 old-build campaign runs). Not reproduced in 32 seeded runs from the save before it (`.qa/stall_city.json`, `pe.js` `stallT` dumps the survivors when a wave lasts too long). Suspect a pathfinding freeze: `pfStep` returns true without moving when the unit is within 0.5 px of its steer target, so a unit whose target is its own cell would stand still out of reach.
- Twist fairness A/B on the bot (early runs, 2 seeds): Arctic blizzards off = no change, Arctic armor rosters off = +0.5..1 wave; Island VBIEDs off = no change (car bombs are 7-13% of fort damage in the runs where they show up), Island permanent night off = +0..1 wave. None is a wall. Caveat: the bot aims at the nearest visible enemy and never uses grenades/airstrikes, so sight cuts (City, Jungle, Island night) may cost a human more than they cost it.

### Battle speed, checkpoints
- Command Tempo removed (each theater refunded what it paid, `tempoRefund`). `speedOpts()`: 1×/2× from the start, 3× once Desert Outpost is cleared (listed in its clear debrief); slow-motion assist 0.75× only (0.5× saves become 0.75×).
- Checkpoints 25/50/75 per theater (`CP_W`), open once that theater has held the wave; `startWaveOk()` snaps an old pick to the deepest open checkpoint. `cpBackPay()` pays 50% of the skipped waves' RP and cash (clear bonus × 14, measured on bot runs) after 5 held waves, with a battle feed line; the Base preview shows the amounts.

### Tuned numbers (model results, bot = weaker than a human: no grenades/airstrikes, nearest-target aim)
- `MAP_DIFT` late hpMul: Mountain 9.5, Coastal 38, City 140, Arctic 550, Jungle 2500, Island 7000, Capital 13500 (early hp0 2/6/30/60/80/90/100; dmg = rew = 1.075^(ln hp / ln 1.11)). Mountain was 9 and Capital 15000 before the twist retune below.
- Free player, 4 sessions/day (~1.2 h play/day), days per theater: Desert 2.6 · Mountain 3.6 · Coastal 1.4 · City 4.6 · Arctic 2.6 · Jungle 10.2 · Island 8.6 · Capital 9.2 → about 43 days (6.1 weeks), ~620 runs, ~51 h of play. Per-theater variance is large (a clear needs one lucky wave-75→100 run once the fort is capped): the same theater from the same arrival ranged 2.6-7.2 days across players.
- Armory caps run out at wave ~94-99 in every theater; after that the push to 100 is R&D-paced (lab timers).
- R&D owned at each clear: 16 · 29 · 34 · 46 · 50 · 75 · 88 · 97 of 107 (the last ~10 tiers finish in the lab about a week after the Capital clear). These are phase 3 bot numbers from before the Infantry Kit merge; the merge folds 7 squad tiers into Infantry tiers without changing RP or lab time per theater, so read them as the same progress on a 100-tier scale.
- +100 gems/day player (buys the 2nd slot, skips long jobs): Jungle 8.6, Island 5.4, Capital 6.8 days (−16…−37% vs free); campaign ≈ 40 days. Free gems earned by the end ≈ 800.

### Progression model and tests (`.qa/` in the worktree, gitignored)
- `cbot.py`/`cbot.js`: campaign bot on a simulated clock (Date.now mocked). 4 sessions a day of 15 min (runs overflow the session, ~1.2 h/day of play), 2× in Desert Outpost then 3×, greedy cheapest Armory buys, research cheapest-first whenever a slot is free, deploys at the highest checkpoint, moves out on each clear. `--gems skip` spends gems on the longest job, `--gemday N` adds N gems a day. `cbrep.py <log>` = per-theater table. `probe.py` = capped-fort difficulty probes; `variants.py` = per-theater multiplier variants from a real arrival save.
- Tests: `t_econ.js` (lab across close/reopen with mocked Date.now, clock rollback, gems ledger, gates, caps, prices, ramp, checkpoints/back-pay, speed, refund, reset, R&D UI) and `t_core.js` (campaign core, updated) via `python h.py dom <name> <file>`.

## Phase 4: dailies, ads, shop (branch `dailies`)
Code: `// ================= PLATFORM (Plat) =================` and `// ================= DAILIES ... =================` (after the GEMS section, before Command Tempo) hold the logic; the UI is `// ---------------- Daily Ops (Base), daily challenge card, ...`, right after the gem shop (`gemHtml`). CSS: the `/* ---- phase 4 ... */` block at the end of the style sheet. Owner decisions kept: gold AAR (the 2x button sits inside it), no #picks/#nextUnl, Armory/R&D untouched. Battle speed is never sold.

**Machine rule (owner's PC crashed once):** run ONE headless Edge/node test at a time, never pools; `shots4.py`/`smoke.py` are sequential.

### Platform layer `Plat`
One seam between the game and the device. The web build has no ads or store; the iOS app routes every call through `window.Shell` (`native/shell.js`, see "iOS app" below). Every native call is guarded: a missing or failing plugin reads as "no ad / not bought", never as an error.

| Call | Web build | iOS app (`window.Shell`) |
|---|---|---|
| `Plat.ad(kind) -> Promise<bool>` (rewarded) | hidden without the dev flag; simulated sheet with SKIP with it | `Shell.ads.showRewarded()`; true only when the reward was earned, settled when the ad closes. No fill: a toast |
| `Plat.interstitial() -> Promise<bool>` | never without the dev flag; simulated with it | `Shell.ads.showInterstitial()`. Pacing lives in `iaOk()`; the counter resets only once one was shown |
| `Plat.buy(sku) -> Promise<bool>` | hidden; simulated confirm sheet with the dev flag | `Shell.iap.purchase(sku)` (RevenueCat). A cancel is silent, a store error toasts. Grants happen in `shopGrant(sku)` |
| `Plat.restore()` | `[]` | `Shell.iap.restore()`: the owned non-consumables; `shopOwn()` sets the flags only. Also run quietly at launch |
| `Plat.notify(when,title,body,id)` / `Plat.cancel(id)` | logged only (`Plat.log`) | `Shell.notify.schedule/cancel` (local notifications; string id hashed to the plugin's int id) |
| `Plat.haptic(kind)` | `navigator.vibrate` while screen shake is on | `Shell.haptic(kind)` |
| `Plat.price(sku, usd)` | `$usd` | the store's localized price |
| `Plat.score(board, n)` | nothing | Game Center, once `PLAT_IDS.lbDaily` is set (`dcEnd` submits the challenge wave) |

- `PLAT_IDS` holds the live AdMob app id and units, Google's test units, the RevenueCat key and the (empty) leaderboard id. Only a release build (`build_www.py --release`) uses the live units.
- Dev flag: URL `?dev=1`, or Settings → tap the SETTINGS title 7 times → "Developer mode" (`S.set.dev`). Web only: the iOS app hides the toggle and ignores the flag. Without it the live GitHub Pages build shows no rewarded-ad button, no gem packs / Starter Pack / Remove Ads (the shop says they are sold in the iOS app), and never an interstitial. QA hooks: `Plat.auto=true/false` settles simulated ads and purchases at once; `Plat.adSecs` sets the simulated ad's length.
- Product ids (App Store Connect + RevenueCat, not created yet), `fort_`-prefixed because App Store ids are unique per developer account and Euchre already sells `remove_ads`/`coins_*`:
  - consumables: `fort_gems_80` $0.99, `fort_gems_500` $4.99, `fort_gems_1200` $9.99 (POPULAR), `fort_gems_2600` $19.99, `fort_gems_7000` $49.99 (BEST VALUE)
  - non-consumables: `fort_starter` $2.99, `fort_noads` $3.99

### Clock safety and roll-out
- Every daily thing keys on `today()` = the local calendar day of `labNow()` (the phase 3 lab clock, which only moves forward with `Date.now()`).
  - Setting the clock back never re-opens a day, re-arms a claim or resets an ad cap (tested).
  - Setting it forward pulls days early, and they are spent: the lab clock stays ahead. A rollback followed by a return to the real time also advances the lab clock (phase 3 semantics). It gains nothing that setting the clock forward wouldn't. The game is offline-only with no trusted time; a server time check is the next step if abuse shows up.
- Daily Ops (missions, streak, rewarded ads) opens after `DY_RUNS`=3 runs with a best of `DY_BEST`=6, with a one-time toast. Old saves get `S.runs`=10 if their best is 10 or more.
- The daily challenge opens once Desert Outpost has held wave `DC_W`=25. Until then a locked line in Daily Ops says so.
- Interstitials never show before `IA_RUNS`=12 runs and `IA_DAYS`=2 days of play.

### Daily missions (`DQ`, `dqRoll`, `dyTick`, `dqAdd`)
- 3 a day, one per category:
  - kills: infantry, vehicles, aircraft, tanks, mortars, paratroopers, landing craft (Coastal only), car bombs, mechanics, drones
  - holding: hold wave N, clear N waves, hold wave N unbreached, deploy at a checkpoint and hold 5
  - actions: airstrikes, grenades, crates, events, directives, start a research, aimed streak
- Goals scale with the theater's best wave. Theater twists weight the fitting missions up (mortars in the Mountain, drones in the Jungle, car bombs in City/Capital/Island).
- Rolls are seeded per save (`S.dy.seed`) + day and never touch `Math.random`, so seeded battle parity is unchanged.
- Live tracking: `_dqK` = the stats an open mission still counts; when it is null the battle hooks return at once.
  - Hooks: `kill` (`dqKill`), wave clear (`dqWave`), `throwNade`, `grabCrate`, `evClear`, `pickPerk`, `airRelease` (player airstrikes only), `cpBackPay`, `labStart`, `streakKill`.
  - Completion: a violet battle-feed line + chime + haptic in battle, a toast at the base.
- Rewards: `DQ_GEM`=3 gems + 1 RP unit each; all three add `DQ_BONUS_GEM`=5 gems + 2 units. Finished missions left unclaimed are banked automatically the next day, never lost.
- RP unit `rpU()` = 2% of the tier price at the player's campaign progress, minimum 5: 5 RP through the Desert, ~10 early in Mountain Pass, ~40 at the Capital.

### Login streak (`stNext`, `stClaim`)
- 7 days: 3, 3, 5, 3, 5, 8, 25 gems (52 a week). Day 7 also pays 2 RP units.
- One grace day per 7-day cycle: a single missed day keeps the streak. A longer gap, or a second miss in the cycle, restarts at day 1.
- The claim card (`#stWin`) opens on the first Base visit of the day (`S.dy.pop`), never over the theater-cleared debrief.

### Rewarded ads (daily caps, `AD_CAP`) and interstitials
- Placements:
  - 2x payout on the AAR: 3/day, campaign runs only; adds the run's earnings to that theater's bank.
  - Second Wind: 2/day.
  - Free supply drop from the pause menu: 2/day, once a run, from wave 3; drops munitions, repair and air strike crates.
  - Directive reroll on the commendation modal: 3/day, once per offer; the three cards shown are excluded.
  - Free gems: 1/day, +10.
  - Lab speed-up (R&D, `labAd`): 2/day shared by both lab slots, 1 h off a running research or Refit timer (finishes it with an hour or less left). See "Lab speed-up ad".
- Never in the daily challenge. A skipped ad pays nothing and doesn't count against the cap.
- Interstitial (`iaOk`) shows at most every `IA_EVERY`=3rd run end and `IA_GAP` 4 min apart. Never:
  - within `IA_RW` 3 min of a rewarded ad
  - with Remove Ads
  - while the theater-cleared debrief is pending
  - on the plain web build

### Second Wind (`swCan`, `swOpen`, `swRevive`)
- Once a run, from wave `SW_W`=6. Not in the challenge, not on retreat.
- When the fort falls, `endRun` freezes the run (`G.over`, `running=false`) behind `#swWin` for `SW_ASK`=10 s (a timer bar, paused while an ad plays). Choices: WATCH AD, REVIVE · 25 gems, END RUN.
- Revive:
  - health and walls back to at least 50%
  - EM screen for `SW_SHIELD` 5 s and rapid fire for 8 s
  - hostiles at the walls pushed out 70 px, enemy shots in flight cleared

### Daily challenge (`dcToday`, `dcStart`, `dcEnter`/`dcRestore`, `dcEnd`, `dcPay`)
- One per day, the same for everyone:
  - a theater drawn from the player's OPEN theaters
  - one modifier: Hazard Pay, Hot Zone (events), Armored Push (+50% vehicles) or Short Supply (crates x0.5)
  - two starting directives
  - a seeded `Math.random` for the run. `_dcRnd` holds the real one, and `R` now reads `Math.random` at call time
- Kit decision: a STANDARD KIT (`DC_KIT` = a share of that theater's Armory caps, e.g. dmg/walls/hp 45%, rate 12, squad 50%) plus the player's own research.
  - Fair: the same fort for everyone, so per-theater cash farming doesn't decide it.
  - Fun: R&D progress still shows, and a new theater's challenge is playable without a fort built there.
  - It can't be used to test-drive or skip that theater's Armory.
- Sandbox: `S.dcHold` parks the theater's lv/bank/best/startWave, its star record, the lifetime medal tallies (`S.ms`) and `S.tkills`.
  - `dcRestore` puts them back at `endRun`, and in `loadSave` if the app died mid-run. Tested byte for byte.
  - In-run RP, stars, medals, wave medals and Second Wind are off. Daily missions DO count.
- Reward once a day, by the day's best wave (`DC_TIERS`):

  | Best wave | 5 | 10 | 20 | 30 | 40 | 50 |
  |---|---|---|---|---|---|---|
  | Gems | 3 | 5 | 8 | 10 | 12 | 15 |
  | RP units | 1 | 1 | 2 | 2 | 3 | 3 |

  A later, deeper attempt is paid as a top-up; attempts are unlimited.
- UI: the Base card shows today's best, attempts and the next tier; the gold AAR shows the challenge result + TRY AGAIN. `dcPay` settles a challenge the app died in on the next render.

### Gem shop (`gemHtml`, `shopBuy`, `shopGrant`, `spLeft`)
- Contents, top to bottom: balance, Starter Pack, gem packs (each shows its bonus % vs the $0.99 pouch), Remove Ads, free gem sources, what gems buy (finish research, second lab slot, Second Wind, cosmetics "coming soon"), a "never buys battle speed" note, the restore link.
- Starter Pack: one-time, open for 72 h from when Daily Ops opens. 400 gems + a voucher that halves the second lab slot to 450 gems. No power.
- Save: `S.shop = {noAds, starter, voucher (1 unused / 2 spent), stT, buys}`.
- RESET keeps gems, `S.shop`, the daily calendar (`S.dy`) and `S.runs/born/ia`, so a reset can't re-claim today's rewards. Also fixed: the phase 3 reset line had a mid-line comment that swallowed `medalSync();save();...`.

### Notifications
- `labStart` schedules `Plat.notify` at the job's end ("Research complete · <tier> is ready"); `labSkip`/`labTick` cancel it; the lab speed-up ad moves it to the new end (same id, so the shell replaces it) or cancels it when the ad finishes the job.
- `dyRemind()` schedules one "Daily Ops" reminder for 19:00 tomorrow on each day's first Base visit, replacing the previous one by id.

### Base nav dot
- `.dot.vio[data-d=base]` (violet) on BASE in the top nav and the dock. It shows for:
  - a finished, unclaimed mission, or the all-three bonus
  - today's streak supply
  - a new day's Daily Ops not yet looked at (`S.dy.seen`)

### Economy impact (RP must stay hard to earn)
- RP from dailies at full completion: missions 5 units/day + streak 2 units a week + challenge 1-3 units ≈ 7 units a day ≈ 15% of ONE tier's price per day.
  - Desert: ~36 RP/day against ~1,900 earned by play.
  - Jungle: ~200 RP/day against ~3,100 (+6.5%).
- Campaign length, from the phase 3 bot logs (`.qa/rpbound.py`; only time the lab sits idle for want of RP can shrink):
  - free players: −0.6% (cb_F) to −2.5% (cb_G)
  - the RP-bound gem-skipping log (cb_P): −14%
- Free gems from dailies: ~14 (missions) + ~7.4 (streak) + ~8 (challenge) ≈ 30 a day, ≈ 40 with the ad. The phase 3 model's +100 gems/day player finished ~7% sooner, so these gems should cost roughly 2-3% more.
- Overall estimate for a free player who plays every day: −3 to −5% campaign length (≈ 41-42 days instead of 43). Not re-simulated with the bot (hours of headless Edge); do that before release if the number matters.

### QA
- `.qa/t_daily.js` (108 checks), run with `python h.py dom daily t_daily.js`. Covers:
  - roll-out gates
  - mission roll: 3, one per category, deterministic, theater-aware
  - live progress through the real hooks; claim, bonus, claim-once
  - midnight banking + reroll; clock rollback (day, streak, ad caps)
  - streak: grace, reset, day 7; the popup flag
  - the web build hides ads, IAP and the 2x button; ad caps + skip; the AAR 2x pays and the AAR stays gold
  - interstitial rules
  - Second Wind: gems, ad, once a run, wave 6, decline, retreat
  - challenge sandbox: byte-identical theater, medal tallies, no RP in the run, pays once by tier, top-up, crash recovery, a new challenge tomorrow
  - reroll exclusion
  - shop: packs, starter + voucher, starter once, Remove Ads, cancel; reset keeps purchases
  - the Base dot
- `.qa/shot4.js` + `shots4.py`: `HASH=#base|streak|aar|sw|shop|dch|dcres|web`, sizes p/l/s/d, strictly one Edge at a time.

## iOS app (branch `ios-native`)
Capacitor 8 wrapper in `native/`, built and uploaded to TestFlight by `.github/workflows/ios.yml`. Copied from Euchre Unleashed's setup: SPM plugins, manual signing with the team's one distribution cert (secrets copied from euchre-unleashed), fastlane `beta`, build number = run number, `macos-26`. Details: `native/README.md` (architecture, ids, products) and `CI_SETUP.md` (secrets, accounts, shipping, cert renewal).

- App Store name "The Fort: Last Stand", home-screen name The Fort, bundle `com.thefort.game`, ASC Apple ID 6816787587. iPhone, portrait + landscape, status bar hidden, home indicator auto-hides, edge swipes deferred.
- `native/shell.js` = `window.Shell`, injected into `<head>` by `native/build_www.py` (with `capacitor.js`, the build stamp and the bundled fonts). The web page never loads it, so GitHub Pages behaves exactly as before.
- Save seam: `save()` → `saveWrite(json)` → localStorage, plus `Shell.store.put` in the app (Preferences, sequence-numbered, debounced, flushed on background). `Plat.boot()` → `saveBoot()` restores the native copy when iOS purged localStorage; the splash stays up until then. No iCloud (Euchre has none).
- Backgrounding: `bgPause()` (persist + pause) runs on `visibilitychange` and on the app's `appStateChange`.
- Ads: ATT at launch, then UMP consent; non-personalized unless ATT is authorized and consent obtained/not required. Test units unless `--release`; the Settings build line says "test ads".
- Tests: `node native/test_shell.cjs` (94, mocked plugins), `node native/check_game.cjs` (scripts compile, PLAT_IDS, fort_ ids, Shell contract), `node native/check_www.cjs` (built page), `python native/test_plat.py` (33, Plat against a scripted Shell in headless Edge, local only).
- Art: `native/assets/art.html` + `render_art.py` draw the icon (gold star fort, green turret, muzzle flash) and the splash; `npx capacitor-assets generate --ios` puts them in the asset catalog.
- Open: the seven IAP products, the Game Center leaderboard, AdMob approval of the listing, App Store privacy labels.

## STORE tab + medals on Base (branch `store-tab`)
Owner request: STORE replaces MEDALS in the nav; medals move onto Base as a collapsible tile.
- **Nav:** `.nv`/`.dk[data-view=store]` (icon `IC.store`, a storefront with a gem; violet dot `data-d=store`). `VIEWS=['base','armory','rd','store']`, so Digit4 opens STORE. Section `.view[data-v=store]` → `#shop` (NOT `#store`: that id is the Armory grid).
- **One shop, two homes:** `renderStore()` paints `gemHtml()` into `#shop`; `openGems()` paints it into the sheet. `shopClick` handles packs, Starter Pack, Remove Ads, restore, ad gems, the lab slot (two taps) and the streak row for both; `gemRefresh()` repaints the open sheet and the home view. `gemHtml()` is grouped `.gsa` (balance + lifetime ledger, Starter Pack, packs/Remove Ads or the "sold in the iOS app" note) / `.gsb` (free gems) / `.gsc` (what gems buy); the sheet stacks them, the view lays them out in two columns from 700px (`#shop .gshop` grid). When today's streak supply is waiting, FREE GEMS leads with a claim row (`data-streak` → `openStreak()`). The sheet still opens from FINISH NOW when short, the second-slot teaser and the header gem chip (on the STORE view the chip scrolls to the balance instead).
- **STORE dot (`storeDot`)**: an unseen Starter Pack (`spOffer()` && `!S.shop.spSeen`), or, until the shop is opened that day (`S.shop.seen`), free gems waiting: today's ad gems (dev/native only) or the streak supply. `shopSeen()` (view or sheet shown) clears it. On the plain web build only the streak can light it. `spOffer()` never starts the 72 h Starter window; the shop showing it does (`spLeft`, unchanged).
- **Medals tile `#medTile`** (`details.panel.manual.medt`, the Field Manual's shell and chevron): left column under the Mission Briefing on desktop, between R&D and the Field Manual on phones (`order:5`). Collapsed: earned/shown count, cash bonus, the closest medal (`medalNext()`, or the closest next rank) with a meter, and the gold dot (`.dot[data-d=medals]`, same `renderHdr` loop). Open state = `S.set.medOpen`; the list is `renderMedals()` into `#medals` (a size container: card grids go compact under 760px of tile width). The roll-out rule (`medalShown`, `m.from`) is unchanged; the old MEDALS nav had no gate, so the tile has none either.
- **medalSeen:** set by `medalLook()` only when the list is really shown: the user expands the tile (`toggle`), `openMedals()`, or the open tile's list is on screen (`IntersectionObserver` → `_medVis`). A collapsed tile, or an open one scrolled away, keeps the dot on through any Base render. A `toggle` that matches `S.set.medOpen` is a render restoring the saved state and is ignored.
- **Redirect:** `setView('medals')` → `openMedals()`: Base, tile open, seen, scroll into view (`scroll-margin-top` clears the sticky header) + flash. The AAR's MEDALS EARNED row links there (`data-view-go="medals"`). Medal toasts stay non-interactive (pointer-events none), as before.
- **QA:** `.qa/t_store.js` (52 checks: nav, Digit4, web view contents, view = sheet markup, chip, STORE dot day cycle + starter, shared click path in both containers, tile collapse/expand/remember + medalSeen, redirect + AAR link); `own.js` also prints nav/dock order, `medTile` and the web Store; screenshots via `.qa/t_sh.js` + `shs.py` (`#base|store|gems ~dev~open~new~fresh~starter~aar~tile~scroll=N`, sequential).

## Lab speed-up ad (branch `ad-lab`)
Owner-approved: an optional rewarded ad that speeds up the running research timer, so ads feed the core loop (play → die → research → come back). Code: `AD_CAP.lab`, `AD_LAB_MS`, `AD_LAB_MIN`, `labAdSt`, `labAd` (DAILIES section, after `adGems`); UI `labAdBtn`, `labAdClick`, the `labUi` ticker check; CSS block `/* lab speed-up ad */` after the lab strip rules.
- **Numbers:** `AD_LAB_MS` = 1 h off per ad, `AD_CAP.lab` = 2 a day, shared by both lab slots. One hour is exactly what the free-gem ad pays at FINISH NOW prices (`labSkipCost(1 h)` = 10 = `AD_GEMS`), so no placement is worth more than another. 30 min would be worth 6 gems (less than the gem ad) and is under 5% of a mid/late job (Mountain 45 min-2.5 h, City 5 h, Capital 15-18 h, Refits 4-24 h); it would read as a token.
- **Rules:** hidden on the plain web build (`adLeft` = 0 without the dev flag or a native ad plugin), before Daily Ops opens, during a run, when the day's 2 are used, and with `AD_LAB_MIN` = 2 min or less left (the ad would outlast the wait). With an hour or less left the button reads FINISH and the ad lands the job. A skipped ad, a no-fill, or a job that landed (or ran out) while the ad played grants nothing and uses no cap slot.
- **Clock safety:** the cut moves `j.end` back on the lab clock by `min(AD_LAB_MS, end − labNow())`: never below now, `t0` unchanged, so the bar jumps forward and a finished job lands through `labTick`/`labLand` (toast, R&D dot, flash) like any other. The day key is `today()` (lab clock): a device-clock rollback never re-arms the cap or stretches the job; rollback + return advances the lab clock (the documented phase 4 rule, same as a forward jump).
- **Ledger / interstitials:** `adUse('lab')` counts it in `S.dy.ads.lab` (the per-day ledger every placement uses) and stamps `S.ia.rw`, so no interstitial shows within `IA_RW` of it.
- **Notification:** a job still running gets `labNote(j)` again (same id `lab:<line>`, the shell cancels then reschedules); a finished one is cancelled.
- **UI:** lab strip: a 60×48 pill (play disc + `−1H` / `FINISH`) beside the running job, the row wrapped in `.labx` (the `.labs.on` row markup is unchanged). Tier card: a secondary blue `.rbt.rad` under FINISH NOW on the desktop tier and Refit cards, and inside the expanded researching row on phones (above the sticky FINISH NOW). Blue = the lab's colour, green when it finishes the job; `wait` (disabled, dimmed) on every button of that job while the ad plays. `data-st` carries `labAdSt`, and `labUi` re-renders R&D only when it changes (cut → fin → gone at the thresholds, back on a new day). Toast after a cut: "Lab sped up: 1h off <tier> · <left> left". The Base R&D panel is unchanged (keeps Base uncluttered).
- **Economy** (`.qa/adlab_model.py` over the phase 3 campaign-bot logs; a speed-up of a lab-hours a day shrinks a lab-paced stretch of T days to T·24/(24+a)): the free logs spend 49-58% of the campaign with the Armory capped and the lab busy (the stretch where the next wave waits on research) and 75-90% with the lab busy. Every daily ad = 2 lab-hours a day (~8% of a lab day; ~86 h of the ~787 lab-hours over a 43-day campaign):
  - lab-paced estimate: −3.8% (cb_G) to −4.5% (cb_F) campaign length, ≈ 1.6-1.9 days of 43
  - upper bound (every busy lab-hour critical): −5.8% to −6.9%
  - the gem-skipping log (cb_P) barely waits on the lab: −0.1%
  - For comparison 3 × 30 min would be −2.9…−3.4%, 3 × 1 h −5.4…−6.5%. With the phase 4 dailies (−3…−5%) a free player who watches everything finishes ≈ 7-9% sooner (~39-40 days instead of 43). RP is untouched (owner rule 3): the ad buys time, never RP. Not re-simulated with the bot.
- **QA:** `.qa/t_adlab.js` (62 checks: numbers, web hidden, dev buttons in the strip and on the card, an hour off + ledger + notification + interstitial hold, cap across slots, rollback, next day, skipped / no-fill, finish-when-short + lands normally, 2 min threshold, hidden in a run, job landing mid-ad, Refit, ledger across reopen, click path with the simulated SKIP, ticker cut → fin → gone → new day). Screenshots: `.qa/t_adshot.js` (`HASH` contains `fin` / `refit` / `scroll`) via `python h.py shot <name> t_adshot.js WxH [phone]`.

## Draw order: units walk over base structures (branch `draw-order`)
Owner request: units must walk over the fuel depot, airstrip and repair facilities, not under them. Before, `draw()` drew every enemy (the CGL `ground` layer) BEFORE `drawAirGround`/`drawLogiGround`, so the runway, apron, depot and motor pool/hangar yards covered hostiles (and crates) crossing them.
- **Base ground pass `drawBaseGround()`** runs right after `drawAtmos()` (cloud shadows), before `drawCrates()` and `drawEnemies()`: `drawRunway()` (runway + the fighters parked on it; High = `drawRunwayHQ`, both split out of `drawAirGround`/`drawAirGroundHQ`) then `drawLogiGround()` (apron, helipads, depot or field dump, `drawRepairGround` = yards + waiting/bay wrecks + gantries/truss/MG nests, `drawJetsLow(false)` = jets on the ground).
- **After the enemies (unit pass):** `drawAirGround` (fort silos/launchers + missile shadows), `drawRepairCrews()` (recovery trucks/tugs and the wreck on their hook, via `drawSiteCrews`), `drawUnits` (friendly vehicles), arty, AA, soldiers. Landed paratroopers, combat mechanics and all hostiles are in the ground layer, so they sit over every pad; unit shadows are drawn with their units, so they fall on the pads. Decals/mines stay under the structures as before; crates now sit on top of them.
- **Depot HP bar** moved out of `drawDepot` into `drawDepotHp()` in the world-UI block (after `drawFuelBars`, beside the site bars in `drawRepairTop`), so a crowd on the fuel farm never covers it.
- Same functions for High/Medium/Low and both render paths (a CGL layer composites at the point it is drawn, so the order holds with ChaosGL on). No new passes, no per-frame allocations added (`drawRepairGround` lost its per-frame `[mp,hg].filter()`). Nothing was baked, so the terrain hash is unchanged.
- QA: `.qa/t_do.js` (`HASH=#<gfx>~<zoom>~<map>[~many]`: hostiles parked on depot/runway/apron/motor pool/hangar/helipad, `many` = +48 on the depot so the GL ground layer switches on), `wk_do.py` (same in WebKit as iPhone 13), `t_pf.js` + `pf.py <gfx> [frames]` (seeded draw-only frame timing, no virtual time). Before/after: High p95 ~3.8-4.6 ms both, Low within noise.

## Infantry Kit and fort design (branch `rd-fort`)
Two owner requests: "the fort should look the same and only change in design until you finish an R&D project", and "tie the soldiers and commander R&D into one".

### One Infantry Kit line (`RLINES.dmg`, label "Infantry Kit")
- The Squad Kit is no longer a research line. It lives in `RLINES.ride` (`{id:'squad', on:'dmg'}`), indexed like any line (`RLINES.squad`, `RLINES.dmg.rides`), so `rTier/rMult/rSig/rPen/sg('squad',…)`, `KIT.squad`, `TIER_G.squad` and every weapon/art reader work unchanged. Each Infantry tier has `sq` = the squad tier it brings, paired by era: `[0,1,2,3,4,5,6,6,7,7]` (Coilgun Vanguard and Vanguard Commander bring no new squad kit).
- `S.rs.squad` stays the squad tier actually owned. A tier lands its squad tier through the lab job (`job.sq`, set by `labStart`, applied in `labTick`). An Infantry Kit Refit also counts for the squad (`rMult` adds the host's Refits).
- Prices: a host tier's `cost`/`ms` = its own (`cc`/`cm`, at the commander's gate) + the ride tiers it brings (each at its old `RS_GATE.squad` price point). `rsPrice(id,k)` is what the tier costs on THIS save: it also bundles squad tiers a pre-merge save fell behind on, and never charges for squad tiers already owned or still running in the lab. Every price reader uses `rsCost`/`rsMs` (`rsWhy`, `labStart`, `rsAffordN`, Base R&D summary, cards, CTA, compare, AAR counter).
- Gates: Infantry tiers keep the commander's gates. The only squad price that changed theater was Drone-Teamed Squad (City 323 -> Coastal 294), so F-15EX moved 286 -> 323 (City wave 23) to keep each theater's RP and lab hours where phase 3 put them (`.qa/rdtot.js` prints the table).

| Tier | Commander | Squad | Opens at | RP (cmd + squad) | Lab |
|---|---|---|---|---|---|
| 1 | Recruit | Militia | start | - | - |
| 2 | Rifleman | Rifle Squad | 1 (Desert w1) | 40 (20 + 20) | 2m |
| 3 | Designated Marksman | Fireteam | 6 (Desert w6) | 70 (25 + 45) | 4m |
| 4 | Squad Leader | Infantry Squad (NGSW) | 52 (Desert w52) | 410 (110 + 300) | 32m |
| 5 | Grenadier Sergeant | Mechanized Dismounts | 158 (Mountain w58) | 1140 (560 + 580) | 3h 30m |
| 6 | Smart-Rifle Operator | Drone-Teamed Squad | 294 (Coastal w94) | 1540 (740 + 800) | 10h 15m |
| 7 | Exoskeleton Trooper | Exo Squad | 458 (Arctic w58) | 2350 (1150 + 1200) | 18h 15m |
| 8 | Coilgun Vanguard | keeps Exo Squad | 616 (Island w16) | 1550 | 12h 30m |
| 9 | Directed-Energy Operator | Directed-Energy Squad | 709 (Capital w9) | 3700 (1850 + 1850) | 30h 45m |
| 10 | Vanguard Commander | keeps Directed-Energy Squad | 794 (Capital w94) | 2100 | 17h 45m |

- Totals: Commander Kit 8105 RP / 60.6 h + Squad Kit 4795 RP / 33.0 h = Infantry Kit 12900 RP / 93.6 h (identical). Whole tree 107520 -> 107590 RP (+70, the F-15EX move), 786.8 -> 787.8 lab hours; per-theater RP and lab hours unchanged except Coastal +70 RP / +1.0 h. Tiers per theater 16/13/13/13/13/13/13/13 -> 13/12/12/13/12/13/13/12.
- Pre-merge saves (no migration step, nothing rewritten): both old tiers are kept as they are. Commander ahead of the squad (`rs {dmg:5, squad:2}`): the squad stays 2 (no free tiers) and the next Infantry tier bundles squad 3-6 at their prices. Squad ahead (`{dmg:2, squad:5}`): the squad keeps 5 and Infantry tiers 3-5 cost the commander part only. A running Squad Kit job keeps its slot and lands as a squad tier (its lab-strip row opens Infantry Kit; `labStart('squad')` is refused; `rsWhy('squad',…)` = "Comes with Infantry Kit"). A running Commander Kit job (no `sq`) lands the commander only. Old squad Refits stay on top of Infantry Refits.
- UI: R&D shows one "Infantry Kit" line; each card has a SQUAD row (`rsRideHtml`: "+ SQUAD" with the squad weapon and signature when the tier brings one); the desktop compare adds SQUAD DMG; the header names the squad in service; the thumbnail paints the commander with a squad member (support weapon when the squad kit has one). Mission Briefing eyebrow "INFANTRY KIT" + squad name; the Armory Squad card's research chip opens Infantry Kit. Owner rules kept: only open lines, current + next tier.
- Parity: `t_par` identical to main (curves -2048449059; midsim/freshsim unchanged, midsim's `rs {dmg:3, squad:2}` keeps its squad 2).

### Fort design follows Fort Walls research (`fortDes`, right before `drawFloor`)
- `fortDes()` = `tierOf('walls')` (the run's snapshot while deployed, the saved tier at the base). It picks the material `wallMat(d)` (T0 timber palisade, T1 precast blocks, T2+ poured concrete), the wall height `wallRise(d, lo)`, the bake seed, and the concertina (`bakeWire`: T0 one coil, T1 two, T2 16u pickets, T3+ triple stack). The tier overlays (`drawWallTier`) were already research-driven.
- Armory levels only size things: `wallHalfAt`/`wallThickAt` (collision, placement), `wireOut` (ring distance, slow). The concrete yard fittings (pallets from ph 40, helipad from ph 60) appear when they fit: a size rule, not a design step. The commander's sandbag ring is on every walled fort (was Walls 2+).
- Caches keyed on the design: `fortBake` (`[ph,wlv,d,up,ppu]`, stores `mat`), the Medium/Low `fortLo` sprite key, and the terrain key (the wire coils are baked into the ground: `…|<wi>d<tier>|…` when wire exists). Terrain parity: at T2 the coils are the old Wire-3 coils and the Desert terrain hash equals main (1443581287). `t_ter`'s seed (Walls 6 / Wire 3, no research = T0 coils) now prints -315567360 by design.
- The moment: the first deployment after a new design (`S.fortSeen` = the last design deployed with walls standing; the very first deployment only records) sets `G.fortUp`; `fortSweep` (called from `drawWallTier`) sweeps a light band across the walls and towers for 2.6 s from 0.5 s and shows a "FORT UPGRADED / <tier>" pill over the north wall at a constant 14 px. A walls tier landing at the base toasts "Fort redesigned: <tier> · rebuilt for your next deployment". Each Fort Walls card shows a FORT DESIGN row (`t.look`, `rsLookHtml`), and its thumbnail is the real fort bake at that tier.

### QA (`.qa/`, gitignored)
- `t_merge.js` (45: data, totals, gates, fresh progression, commander-ahead / squad-ahead saves, running squad job in one and two slots, old commander job, old squad Refit, Refits reach the squad, UI) and `t_fort.js` (23: material and wall colour across Walls 2/6/12 at T0/T1/T2/T5, Walls 3→4→7 keeps the palisade, wire coils vs Wire level, terrain parity at T2, Low sprite key, mid-run freeze, the upgrade moment once, thumbnails, bag ring). Run: `python h.py dom merge t_merge.js`, `VT=40000 python h.py dom fort t_fort.js`.
- Updated: `t_econ.js` ("two at once" uses walls; 100 gated tiers). `rdtot.js` = the before/after economy table. `fortshot.py` = WebKit iPhone shots (`walls:wire:tier:gfx:zoom`, `sweep:walls:wire:tier:secs`, `rd:<line>`).
