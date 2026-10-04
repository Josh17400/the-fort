# The Fort — Handoff

Top-down modern-military roguelite fort defense, headed for the iOS App Store. Tap enemies to shoot, earn cash per kill, die, spend cash (Armory) and Research Points (R&D lab, real-time timers), come back tomorrow. 8-map campaign.

- **Live web build:** https://josh17400.github.io/the-fort/ (GitHub Pages from `main` of `Josh17400/the-fort`; a push goes live in ~1 min).
- **Whole game = one file:** `index.html`. No build step for the web. `native/` is the Capacitor iOS wrapper built only by CI.
- **Last pushed commit (2026-10-02):** `d6459e4` "Longer early research: Desert 30-60 min from wave 25, Mountain 2-4 h; War Chest 25 waves for 75 gems". `main` = everything; no open branches matter.

---

## START HERE (state on 2026-10-03)

### Where things stand
- The campaign (phases 1-4), iOS wrapper and every owner request through 2026-10-02 are **merged, pushed and on TestFlight**. The owner tests on an iPhone through TestFlight and sends screenshots; fix, push, ship a new TestFlight build.
- **2026-10-03, not pushed yet:** the pre-launch batch (theater bosses, game feel pass, retention + launch readiness) is merged into local `main` with the owner-approved review fixes (see "Pre-launch batch merge" at the bottom). Not pushed, no TestFlight build yet: the first CI build after pushing is also the compile check for the retention branch's Swift (`GameKitPlugin.swift`: `requestReview`, `cloudGet`/`cloudPut`).
- Sections below are in build order; each feature has its own section with code names, numbers and QA scripts. The newest are at the bottom: STORE tab, lab ad, draw order, Infantry Kit + fort design, cash packs, base structures under raid.

### How to ship
1. Change `index.html` in the main checkout (`C:\Users\joshu\Documents\Code Stuff\the-fort`), or in an agent worktree branched from `main` and merged back.
2. Run the regression tests (below), one at a time.
3. `git push origin main` (web goes live).
4. TestFlight: `"/c/Program Files/GitHub CLI/gh.exe" workflow run ios.yml --repo Josh17400/the-fort`, then `gh run watch <id> --exit-status`. A build takes ~6 min; Apple processes it in 10-30 min and testers get it automatically.
   - `gh` is installed and logged in as Josh17400 on this PC (not on PATH in Git Bash: use the full path).
   - "release" input unticked = Google TEST ads. Tick it only for the App Store submission build.
   - A failed build: `gh run view <id> --log-failed | grep -i "error:"`, fix, push, re-run.

### Regression tests (`.qa/`, gitignored, local to this PC)
Run from `.qa/`, **one headless process at a time** (the owner's PC crashed when ~100 headless Edge processes ran at once): `python h.py dom <name> <file>.js` prints the result in the page title.
- Must stay green: `t_core` 57, `t_econ` 82, `t_daily` 110, `t_adlab` 62, `t_merge` 45, `t_fort` 23, `t_tw` 20, `t_cash` 69, `t_store` 52 (its "tile scrolled into view" check flakes headless), `own.js` (owner decisions), `PRE=pre_seed.js HASH='#unit' ... t_basehp.js` 38, `PRE=pre_seed.js HASH='#unit' VT=60000 ... t_tb.js` 195 (theater bosses), `PRE=pre_seed.js VT=60000 ... t_feel.js` 47 (game feel), `t_ret` 90 (retention: welcome back, review, reminders, Game Center incl. the `gameCenter` switch, iCloud, analytics), `t_rvfix` 10 (its review fixes). Spot checks: `PRE=pre_seed.js HASH='#rout~desert' ... t_rv.js` (wave 101 after ~7.4 s), `HASH='#desert~60~40~1' VT=60000 ... t_new.js` (cw=0).
- Desert parity: `PRE=pre_seed.js VT=60000 python h.py dom par t_par.js` must print `curves=-2048449059` and midsim `w21 k887 hp-24673 ... bank1019576 ... ex1101626` (since the 2026-10-02 directive halving; it was `w21 k896 hp-3646 bank1023409 ex-5889330`: midsim picks directives). A change to Desert wave curves or the Desert sim is a red flag.
- Smoke: `MAP=<id> python smoke.py 'mid#7'` (or `fresh`/`maxed`), expect `cw=0 errbox=false`.
- iPhone-accurate screenshots: Playwright WebKit is installed (`python -m playwright`, iPhone 13 profile; see `.qa/wk2.py`, `cash_shot.py`). Read the PNGs and iterate before shipping UI.
- Native: `node native/test_shell.cjs`, `node native/check_game.cjs`.
- Never run one shell command longer than ~150 s; background long jobs and poll.

### Accounts and store setup (all done)
- **App Store Connect:** "The Fort: Last Stand" (home-screen name "The Fort"), bundle `com.thefort.game`, Apple ID 6816787587, SKU thefort001.
  - 7 IAPs created, priced (USD base, all 175 regions) and described: `fort_gems_80/500/1200/2600/7000` ($0.99/4.99/9.99/19.99/49.99, consumable), `fort_starter` ($2.99), `fort_noads` ($3.99) (non-consumable).
  - They still need an App Review **screenshot** each (the in-game Store) before submission.
- **TestFlight:** internal group "Internal" (all builds). Testers: the owner `joshua17400@icloud.com` and his wife `corriev10@yahoo.com` (a DEVELOPER team member; The Fort was added to her visible apps).
- **App Store Connect API:** key `Z27KSNKHDB` (App Manager). Its `.p8` lives only in the owner's local folder `Documents\Code Stuff\pass\`. **Never commit it.** Python JWT pattern for API calls: ES256, `kid` = key id, `aud` = `appstoreconnect-v1`, issuer id = the `ASC_ISSUER_ID` repo secret.
- **GitHub repo secrets** (all 6 set): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`, `IOS_CERT_P12_B64`, `CERT_EXPORT_PASS`.
  - The distribution cert was minted by `ios-mint-cert.yml`, expires 2027-09.
  - The p12 must be legacy 3DES/SHA-1, or macOS reports "MAC verification failed"; the Fastfile now exports that format.
  - The owner's other apps (Euchre, Forgeborn) use 2 other distribution certs. Never revoke those.
- **RevenueCat:** project "The Fort" (`e8402460`), app `app1bc41901fc`, 7 products, entitlement `no_ads` on `fort_noads`. Its public iOS key is in `PLAT_IDS`.
- **AdMob:** iOS app `ca-app-pub-8913077727879528~2474795069`; rewarded `/5913234786`, interstitial `/3784007309` (in `PLAT_IDS` and Info.plist). It shows "Requires review" until the app is live and linked.

### Before App Store submission (not done)
- Add the IAP review screenshots.
- Fill in the App Store listing: description, screenshots, privacy labels (AdMob collects data), age rating.
- Run a `release` build.
- Game Center, iCloud, analytics: see the owner action list in "Pre-launch batch merge" (Game Center is OFF via `PLAT_IDS.gameCenter:false` until its items exist in App Store Connect).
- EU trader status is unset on the account (affects EU distribution only).

### Owner decisions from 2026-09-28 to 10-02 (do not undo)
- **Navigation:** the STORE tab replaces MEDALS in the nav. Medals are a collapsible tile on Base, styled like the Field Manual.
- **Fort art:** the fort's look changes **only** when a Fort Walls R&D tier completes. Armory levels change stats and size only.
- **Infantry Kit:** the Commander Kit and Squad Kit are **one line**. Each tier brings the squad tier of the same era.
- **Draw order:** units draw **over** the fuel depot, airstrip, helipads and repair yards.
- **Base structures:** the depot, motor pool and hangar must be destructible under pressure (see "Base structures under raid"). **The runway stays as is: no HP, no changes.**
- **Cash packs:** gold, not gem violet (cash is gold everywhere). Supply Crate = 3 waves for **15 gems**; War Chest = **25 waves for 75 gems**; the cash ad = 1 wave a day. Limit 3 packs a day.
- **Research lab times:**
  - Desert: tutorial tiers (gate < 25) take minutes; from wave 25 they take 30 to 60 min.
  - Mountain: 2 to 4 h.
  - Coastal: 4 h and up.
  - City and later: unchanged (5 h up to ~31 h).
  - Total ~830 lab hours.
- **Speed:** never sell battle speed for gems or ads.
- **Ads:** reward ads only, plus rare interstitials (Remove Ads $3.99).
- **Housekeeping:** all old agent worktrees and merged branches were removed on 2026-10-02; only `main` remains. Remove each new agent worktree after merging (`git worktree remove -f -f <path>`, one at a time: some take ~50 s because of their `.qa` folders).

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
| Lab + gems | `S.lab`, `labStart`, `labTick`/`labLand`, `labLeft`, `labSkip`, `labSkipCost`, `labBuySlot`, `labUi` (1s ticker). Lab speed-up ad `labAd`/`labAdSt`/`labAdBtn` `S.gems`, `gemAdd(n,src)`, `gemSpend(n,why)`, `GEM_FREE`, `openGems()`. Cash packs `CASH_PACKS`, `cashWave`, `cashBuy`, `adCash`, UI `cashHtml`/`cashTop` (see "Cash packs"). Shop markup `gemHtml()`, one click handler `shopClick` on `#gemBody` (sheet) and `#shop` (STORE view), repaint `gemRefresh()` |
| RP economy | `rpWave(w)` (0 before wave 10, then +1 per 10 waves, bonus on multiples of 10). Tier prices follow the tier's campaign gate (`rsCostAt`). Record bonus +1 only when w>=10. Medals give `rpGain(3)`. Checkpoint back-pay `cpBackPay` (cash + RP, after 5 held waves). Veteran back-pay `min(150,best+3*medals)` |
| Graphics | presets via `S.set.gfx`, `GFX`, `hiGfx()`. Baked sprite cache: `hqBake`/`hqDraw` (tier keys end in `_tN`). Fort look = `fortDes()` (Fort Walls research) via `wallMat`/`wallRise`; Armory levels only size it |
| Day/night + shadows | `G.todT`, `SH` (len/alpha), `hqShadow`. Vehicles have headlights at night |
| Renderer | ChaosGL: instanced WebGL with a Canvas2D fallback |
| Layout | `fortHalf`, `wallThick`, `wireOut`, `laneHalf(k)`, `driveLane`, `placeSquad`; scale table `US` |
| Camera | Portrait fill factor `pf` in the scale calc. Pinch/wheel zoom `G.uZoom` (1–4) |
| Menus | `homeView` (`VIEWS` = base/armory/rd/store, keys 1-4) → `renderHome` → `renderBase` / `renderArmory` / `renderResearch` / `renderStore`; `renderAAR` on Base. Medals are the Base tile `#medTile` (`renderMedTile` → `renderMedals`); `setView('medals')` → `openMedals()` |
| Battle HUD | `drawHud`, layout object `HL` (modes `port`/`land`/`desk`), `hudPanel()` (legacy alias `panel()`), `drawRepairHud`, `coachPlace`, `#intel`, `#armChip` |
| Repair | Motor pool (vehicles) and hangar (aircraft) repair facilities |
| Audio | Baked procedural sound bank (see "Audio engine"): DSP kit `b*` + recipes `SREC`/`GUN`, bank `SB`/`sbGet`/`sbIdle`, player `pv`, gains `SG`, `sfx(name,x,y,k)`, `tone()`, `duck()`, graph `auGraph`. `audioFrame()` is wrapped in try/catch in the frame loop. Cricket gains are `nk*0.6` / `nk*0.42` (turned down on request) |
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
- 100 researchable tiers since the Infantry Kit merge (was 107; see "Infantry Kit and fort design"): Desert Outpost 23 (Rifleman at wave 1 as the tutorial), Mountain 10, Coastal 8, City 12, Arctic 9, Jungle 13, Island 13, Capital 12 since every line's first tier moved early (see "Owner balance pass 2026-10-02"; before: 13/12/12/13/12/13/13/12 in the order the old wave gates rolled them out). Vanguard Commander is last, at Capital Defense wave 94.
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
- Uses: finish research now, `labSkipCost(ms)` = linear 25 gems per 30 min (`GEM_PER_H` 50), per started minute: ceil(minutes × 25/30), min 1 (1 min 1, 10 min 9, 30 min 25, 1 h 50, 8 h 400, 18 h 900; was ceil(10 × hours^0.8) until 2026-10-02); 2nd lab slot 900. Battle speed is never sold.
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
  - 2x payout on the AAR: no daily cap since 2026-10-02 (`AD_CAP.x2` = Infinity), once per run end, campaign runs only; adds the run's earnings to that theater's bank.
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
- `.qa/t_daily.js` (110 checks), run with `python h.py dom daily t_daily.js`. Covers:
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

- App Store name "The Fort: Last Stand", home-screen name The Fort, bundle `com.thefort.game`, ASC Apple ID 6816787587. iPhone, portrait + landscape, status bar hidden, edge swipes deferred (the home-indicator auto-hide override was removed: CAPBridgeViewController declares it public, not open).
- `native/shell.js` = `window.Shell`, injected into `<head>` by `native/build_www.py` (with `capacitor.js`, the build stamp and the bundled fonts). The web page never loads it, so GitHub Pages behaves exactly as before.
- Save seam: `save()` → `saveWrite(json)` → localStorage, plus `Shell.store.put` in the app (Preferences, sequence-numbered, debounced, flushed on background). `Plat.boot()` → `saveBoot()` restores the native copy when iOS purged localStorage; the splash stays up until then. No iCloud (Euchre has none).
- Backgrounding: `bgPause()` (persist + pause) runs on `visibilitychange` and on the app's `appStateChange`.
- Ads: ATT at launch, then UMP consent; non-personalized unless ATT is authorized and consent obtained/not required. Test units unless `--release`; the Settings build line says "test ads".
- Tests: `node native/test_shell.cjs` (94, mocked plugins), `node native/check_game.cjs` (scripts compile, PLAT_IDS, fort_ ids, Shell contract), `node native/check_www.cjs` (built page), `python native/test_plat.py` (33, Plat against a scripted Shell in headless Edge, local only).
- Art: `native/assets/art.html` + `render_art.py` draw the icon (gold star fort, green turret, muzzle flash) and the splash; `npx capacitor-assets generate --ios` puts them in the asset catalog.
- Open: IAP review screenshots, the Game Center leaderboard, AdMob approval of the listing, App Store privacy labels (see START HERE).

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
- **Numbers:** `AD_LAB_MS` = 1 h off per ad, `AD_CAP.lab` = 2 a day, shared by both lab slots. One hour was exactly what the free-gem ad pays at FINISH NOW prices (`labSkipCost(1 h)` = 10 = `AD_GEMS`; since the 2026-10-02 skip price it is 50, so the lab ad is now the richest placement), so no placement is worth more than another. 30 min would be worth 6 gems (less than the gem ad) and is under 5% of a mid/late job (Mountain 45 min-2.5 h, City 5 h, Capital 15-18 h, Refits 4-24 h); it would read as a token.
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

## Cash packs (branch `cash-packs`)
Owner-approved: gems buy Armory cash for the active theater, sized to the player. Code: `// ---- cash packs` in the DAILIES section (after `labAd`), UI `cashHtml`/`cashClick`/`cashPaid` (after `gemHtml`), `cashTop`/`cashTopClick` (after `renderArmory`), CSS `/* cash packs */` (before the pause-menu ad rules). Owner rules kept: battle speed and RP are never sold, the Armory still lists only available, not-maxed upgrades, the AAR stays gold.

### One wave of cash (`cashWave`)
- History: `S.maps[id].cw` = the last `CASH_RUNS` (5) campaign runs on that theater as `[cash, waves fought]`, written by `cashLog()` at `endRun` (waves = `G.wave - G.startWave + 1`, cash = `G.earned` minus the checkpoint back-pay `G.cpCash`, which pays for skipped waves). Daily challenge runs are not logged. It lives on the theater record, so `switchMap` needs nothing; RESET wipes it with the campaign.
- Model `cashModel()`: kills, crates and events pay about `CP_KILLX` (14) x the wave-clear bonus `8w·waveRew(w)` (the back-pay constant), averaged over a run from the deploy checkpoint (`startWaveOk`) to `max(5, S.best)`, x War Bonds `(1+0.15·bounty)` x `medalMul()`. Calibrated on the phase 3 bot logs (`.qa/cbfall.py`): real/model median 0.9-1.1 on every theater, 1.4 on the Capital (perks/streaks); early runs sit lower (p10 0.4-0.8).
- `cashWave() = (sum cash + CASH_PRIOR·model) / (sum waves + CASH_PRIOR)`, `CASH_PRIOR` = 5 waves: no history = the model; one short run can't swing it; five normal runs (~100 waves) make it ~95% history.
- Amounts `cashAmt(w) = cashRound(w·cashWave())`, rounded to exactly what `fmtN` prints ($378, $1,230, $13.2k, $1.3M), so the button shows the exact amount paid.
- Examples, model only (no history), War Bonds level in brackets, checkpoint = the deepest open one (`.qa/t_cashprobe.js`):

| Theater, best wave (bounty) | 1 wave | Supply Crate (3) | War Chest (10) |
|---|---|---|---|
| Desert w5 (0) | $378 | $1,140 | $3,780 |
| Desert w25 (4) | $4,870 | $14.6k | $48.7k |
| Desert w50 (8) | $58.4k | $175k | $584k |
| Mountain w30 (10) | $119k | $356k | $1.2M |
| Coastal w50 (14) | $1.0M | $3.1M | $10.2M |
| City w50 (16) | $2.8M | $8.3M | $27.7M |
| Arctic w60 (18) | $29.4M | $88.1M | $294M |
| Jungle w70 (20) | $156M | $467M | $1.6B |
| Island w80 (22) | $1.4B | $4.1B | $13.8B |
| Capital w90 (24) | $3.8B | $11.4B | $37.9B |

### Packs, prices and the value check
- `CASH_PACKS`: Supply Crate = 3 waves for 4 gems, War Chest = 10 waves for 10 gems (+33% cash per gem). The War Chest costs exactly what the free gem ad pays.
- Value model (calendar time of campaign saved): in the cash-paced stretch (a theater before its Armory caps) cash arrives at ~380 waves' worth a day (bot logs, `.qa/cbcash.py`: 316-549 waves/day at 1.2 h of play), so 3 waves ≈ 11 min and 10 waves ≈ 38 min of that stretch. The same gems as a research skip (`labSkipCost` inverted: h = (g/10)^1.25) buy 19 min (4 gems) and 60 min (10 gems) of a lab-paced stretch. Ratio cash/skip: Supply Crate 0.60, War Chest 0.63 (0.41-0.76 across the logs' waves/day). A gem buys about two thirds of the progress a timer skip buys.
- The first sketch (15 / 40 gems) would have been ~0.11, nine times worse than a skip. Knobs: `CASH_PACKS[].w/.g`.

### Limits and balance
- `CASH_DAY` = 3 packs a day, across all theaters, on the lab-clock day (`S.dy.cb = {d, n}`): a clock rollback never re-arms it (rollback + return = a forward jump, the phase 4 rule). Why: the price per gem is low, and a hoard of free gems (~800 by the end of the campaign) must not buy out a fresh theater's early Armory in one sitting. 3 War Chests = 30 waves ≈ 8% of a day's cash.
- Campaign effect: cash only reaches the per-theater caps sooner. The cash-paced stretch is ~40% of the campaign (bot logs); the R&D-timer-paced endgame is unchanged. Upper bound, the daily limit every day: that stretch shrinks ~7%, about −3% campaign length (~1.2 days of 43). A free player spending ~30 gems a day here instead of on skips gets about a third less progress for them, so skips stay the better use of gems. Not re-simulated with the bot.
- Early game: the section opens with Daily Ops (3 runs, best 6). Desert w5 packs are $1,140 / $3,780, against ~300 waves of play a day there.
- Shown only while cash can still buy something here: `cashNeed()` = every Armory level left up to this theater's caps, minus the bank. Nothing left, or the bank already covers it: hidden. The bigger pack shows only while the smaller one leaves something to buy. Hidden in a run, in the challenge sandbox and before Daily Ops.
- `cashBuy(id, n)`: `n` is the amount the button showed; a stale button buys nothing. Pays `gemSpend(g, 'cash')` (lifetime ledger `S.gemT.out.cash`), credits `S.bank` (the active theater only), counts `S.shop.cb[id]`. RP is never touched.

### Rewarded ad
- `AD_CAP.cash` = 1 a day, `AD_CASH_W` = 1 wave (`adCash`, through `adWatch('cash')`: per-day ledger `S.dy.ads.cash`, stamps `S.ia.rw` so no interstitial shows within `IA_RW`). A skip or no-fill grants nothing and uses no slot. Hidden on the plain web build (`adLeft` is 0 without the dev flag or a native plugin) and whenever the packs are hidden. Lifetime count `S.shop.cb.ad`.
- One wave is worth ~4 min of the cash-paced stretch, ~1-2 gems: less than the other ads (the gem ad and the lab ad are worth 10 gems). The owner asked for 1 wave; `AD_CASH_W` = 5 would match the others. Not added to Daily Ops, which already has an ad button.

### UI
- STORE view and gems sheet: a CASH · <THEATER> block after the balance/gem packs (`.gsx`): the day's allowance chip (n LEFT TODAY / BACK TOMORROW), "One wave here pays about $X" (average of the last N runs, or estimated from the best wave), two cards (waves, exact amount in gold, name, gem price; two taps: TAP TO CONFIRM in gold for 3 s, like FINISH NOW), the ad row (dev/native), and a note that cash buys Armory levels here up to the caps. Short on gems: the price is dashed and a tap flashes the balance. Two-column STORE (700 px+): the block heads the right column above FREE GEMS.
- Armory: one line (`.c-cash`) above the cards: "Short $11.3k for Body Armor? Top up +$386k [gem 4]". It targets the cheapest visible (current category) card the bank can't pay for and offers the smallest pack that covers the gap. It shows only when a pack covers the gap, the player has the gems and the day's allowance is left (it never nudges towards buying gems), and replaces the "Nothing affordable here yet" callout when both would show. Two taps (CONFIRM); the card flashes with its now-green UPGRADE button. The name scrolls to the card.
- STORE subtitle: "Gems finish research early, open lab slots and top up a theater's cash. They never buy battle speed."

### QA (`.qa/`, gitignored)
- `t_cash.js` (69 checks): numbers, `cashRound` = what `fmtN` prints, model scaling Desert w5 → Capital w90 + War Bonds + checkpoints, history (logged, back-pay out, challenge skipped, last 5, weighted, bad entries), per-theater history and bank, prices + ledger + stale amount + RP untouched, the daily allowance across theaters + rollback + next day, hidden states (roll-out, run, maxed, bank covers all, challenge, chest only when needed), two taps in the view and the sheet, short on gems, the ad (web hidden, dev, skip, pays one wave, cap, interstitial hold, rollback, click path), the Armory line (right pack, right card, per category, no line when uncovered / short on gems / allowance used, two taps) and the owner rule. Run: `python h.py dom cash t_cash.js`.
- `cash_shot.py <name> <store|armory|sheet> <WxH> [dev] [hist] [arm] [out] [scroll=N]`: WebKit screenshots (iPhone 13 profile under 1000 px) of a City Ruins w48 save. `cbcash.py` / `cbfall.py`: the economy numbers above from the phase 3 bot logs (`cb_F/G/P.jsonl`, copied in). `t_cashprobe.js`: the example table.
- Unchanged: t_core 57, t_econ 82, t_daily 108, t_store 51/52 (the "tile scrolled into view" check fails on main too), t_adlab 62, t_merge 45, t_fort 23, t_tw 20, own.js, t_par identical (curves -2048449059, midsim w21 k896 hp-3646 bank1023409 ex-5889330).

## Base structures under raid (branch `base-hp`)
Owner report: "The fuel depot is way too hard to destroy, along with the airstrip and the repair facility." The structures with HP are the fuel depot (`G.depot`), the motor pool (Repair Facility, `G.mp`) and the maintenance hangar (the airstrip's service yard, `G.hg`); the runway itself has no HP and still can't be hit. Code: the `RAID` block right after `dAaDmg` (LOGISTICS), `shLive`/`shHot`/`shRaid`/`shArty`/`shPatch`/`shWarn` right after `hitDepot`, `hitSite` next to `siteEnemy`, the spawn hook in `spawn()`, and `fireMortar`/`fireMLRS`.

### Why they never fell (measured on main, `.qa/p_basehp.js` / `t_basehp.js`, bot fort deployed at checkpoint 25)
- **HP**: `depotHpAt` = max(800, 0.9 x wall max) x 1.35^Depot Hardening (x1.298 a level past the knee), and the yards took x1.4/x1.5 of that. With every line at 40% of its cap the depot had **7.8M HP against 193k of walls (40x)**; at 55% it was 363M against 2.5M (145x).
- **Damage**: hits on structures skipped `fortPress`, so from wave 25 they took less and less of what the fort takes.
- **Healing**: +25% of max at every new wave plus Engineers regen with no pause under fire.
- **Targeting**: only an enemy that happened to pass within range+70 of a structure, and was visible, rolled to divert (35-50% depot, 12-22% yards): 1-3 enemies a wave, most killed before they fired. Mortars/MLRS never shelled them.
- Result: over waves 25-55 a structure took ~0.2% of its HP and healed all of it. 0 of 108 structure-runs lost one, even with Depot Hardening and Defenses at 0 and the fort falling around them.

### What changed (`RAID` knobs)
- **HP** = the fort's wall max x `RAID.hp` 0.18 (motor pool x1.4, hangar x2: its long yard by the runway draws the most raids) x `hardMul(Depot Hardening)` = 1 + `RAID.hard` 0.2 per Desert-sized level. Levels scale to the theater's cap (`CAPS.darmor[0] / capAt('darmor', ord)`), so the cap is ~x8.2 in every theater: real but bounded (it no longer compounds). Depot Defenses keep their -10..30% damage cut, MG nests and AA gun. The Armory card copy says so.
- **Pressure**: `hitDepot`/`hitSite` multiply by `fortPress(G.wave)` like `damageFort` (parity from wave 25).
- **Patching**: `shPatch` = Engineers (`repairAt`, Sapper Teams bonus) only after `repairHold()` without a hit, like the walls. The free +25% per wave is gone.
- **Raiders** (`shRaid`, called in `spawn()` for wave spawns that don't stand off): from wave `RAID.w0` 8 a ground enemy may pick the live structure nearest its bearing, only within `RAID.arc` 0.9 rad (so nobody walks through the fort to get there). Chance by class `RAID.raid`: car bomb 0.45, technical 0.22, APC/IFV 0.14, MBT 0.12, bomber/RPG 0.1, brute 0.06, shooter 0.05, grunt/runner 0.03; x`RAID.hot` 2 on boss waves (w%10) and during hostile events (`shHot`). A depot raider gets `e.dep=true`, a yard raider `e.dep=false` + `e.fsite`; `depotEnemy`/`siteEnemy` then drive them in. A car bomb that reaches a structure goes up with `vbiedBlast`. If the structure falls first, raiders go back to the fort as before.
- **Artillery** (`shArty`): `RAID.arty` 20% of mortar shells / MLRS salvos not already aimed at a vehicle land on a random live structure (±15 / ±40 scatter, `dep`/`site` on the eshot, so the warning rings show where they land).
- **Warning** (`shWarn`): under `RAID.warn` 50% a feed line "FUEL DEPOT / MOTOR POOL / HANGAR UNDER ATTACK · n%" (once; re-armed when patched past 80%). Loss behaviour is unchanged (depot: no refuelling for the run; yards: no repairs for the run; banners as before).
- RNG: `shRaid`/`shArty` draw nothing when no structure is standing, so saves without them replay bit for bit (`t_par` identical).

### Numbers (bot fort: auto-fire only, no taps/grenades/airstrikes, so a human who shoots the raiders does better). 4 seeds per plan, 3 structures each; plans = Depot Hardening + Defenses at 0 (neglected) / at the fort's own share of the cap (typical) / at 90% of the cap (hardened)
| Fort (every line at f of its cap), falls at | Before (main) | After |
|---|---|---|
| Desert f0.4, ~w41 | 0/36 lost; neglected min HP 0.89-1.00 | neglected lost 12/12 (w37-39, 1-3 waves before the fort); typical dips <50% in w25-40 11/12; hardened lost 1/12, min 0.42-0.97 |
| Desert f0.5, ~w52 | 0/36 lost | neglected lost 12/12 around w47-51 (3.3 waves before the fort); typical lost in the last 0-2 waves; hardened reach w50 6/6 |
| Desert f0.55, ~w57 (8 seeds) | 0/36 lost (4 seeds), min 1.00 | runs that hold w50 and lose a neglected structure by w50: **2 of 8 (1 in 4)**; neglected fall 4.5 waves before the fort; typical dip <50% in w41-55 12/24; hardened reach w50 24/24, never lost more than 2 waves before the fort |
| Capital f0.55, ~w39 | 0/36 lost | neglected lost 11/12; typical dip <50% 5/12; hardened lost 0/12, min 0.19-0.95 |
- Fort itself (same seeds, mean death wave before -> after): Desert f0.4 40.8 -> 40.8, f0.55 57.3 -> 56.9 (neglected plan 58.3 -> 56.3: running without fuel/repairs for ~4 waves costs about a wave and a half, which is the point; typical/hardened within seed noise), Capital 39.0 -> 39.0. Desert wave curves untouched (`t_par` curves -2048449059).
- Smoke (unseeded): Desert mid#7 w45 depot min 0.98; Desert maxed w103-104 all >= 0.98; City mid#7 w34 depot min 0.94; City maxed w77 (walls min 0.86-0.97): depot/motor pool/hangar min 0.81/0.91/0.55 in one run, the hangar lost at w76 in another (before: all 1.00).
- On a 390-wide portrait phone the depot sits at the right edge of the fort-centred camera (it always has); the HUD depot pill and the new feed line carry the warning there.

### QA (`.qa/`, gitignored)
- `t_basehp.js` (PRE=pre_seed.js): `HASH=#unit` = 28 checks (HP formula, bounded hardening, same cap multiplier in every theater, run HP of all three, fortPress on depot and yard, Defenses cut, no refill + patch hold for depot and yard, warning once / re-armed / yard warning, raid rate by class and never from across the fort, no raids before w8, boss waves raid harder, mortar crews never walk in, ~20% of shells on structures, a shell on the depot spares the walls, loss behaviour, no extra RNG draws without structures). `HASH=#<map>~<f>~<seeds>[~<wmax>[~<RAID knobs>]]` = the survival sims above with target checks for where the fort falls (keep to 4 seeds per call: ~100 s). Run: `PRE=pre_seed.js HASH=#unit VT=30000 python h.py dom bhu t_basehp.js`.
- `p_basehp.js`: per-wave probe (min HP, damage vs healed, attackers by type, artillery share; `~detail` prints every wave). Works on main via `SRC=`.
- `smk_bh.py`: smoke mid#7/maxed with wall + structure minimums in the result line (`RUNS=` picks map/mode pairs, `SRC=` another build). `t_bhshot.js`: the screenshot (`bhshot_390x844.png`, `bhshot_844x390.png`: Desert w38, depot 49% under raiders, feed line up).
- `t_cash.js` updated for the owner's pack prices (Supply Crate 15 gems, War Chest 75): the "chest cheaper per wave" check is now "packs ordered small to big", price literals read `CASH_PACKS`. 69/69.
- Unchanged: t_core 57, t_econ 82, t_daily 108, t_adlab 62, t_merge 45, t_fort 23, t_tw 20, own.js, t_par identical (curves -2048449059, midsim w21 k896 hp-3646 bank1023409 ex-5889330: its save has no depot or yards).

## Owner balance pass 2026-10-02 (branch `worktree-agent-a65c8fecdc8181cbb`)
Six owner notes, one branch. Desert wave curves untouched (`t_par` curves -2048449059); the midsim moved only because it picks directives (verified: main + the directive edit alone prints the same new midsim).
- **War Bonds** (`U` 'bounty'): +2.5% money per level (`WB` = 0.025, was 0.15) in `money`, `cpCash`, `cashModel` and the card (`+2.5% money`, one decimal). Desert cap 20 = +50% (was +300%), so cash runs on the base kill/wave curve much more; the cash-pack table above was computed at 15% and is now smaller for saves with War Bonds.
- **Field Commendation directives** (`PERKS`): every bonus halved per rank, text to match. Hollow-Point +12.5%, Rapid Reload 7.5%, Eagle Eye +7.5% crit, Tungsten 7.5% pierce, Overwatch +10%, Combat Engineers +17.5% wall HP (still full rebuild), Medevac +17.5% max HP (still full heal), Salvage +12.5% cash, Hazard Pay 12.5% tougher / +20% pay (both sides halved so it stays a fair trade; also the daily-challenge modifier), Supply Drop 2 crates now + crates 20% more often, Fire Mission 17.5%, Grenadier reload x0.825 per rank and +1 grenade per throw every second rank, CAS cooldown x0.825, Minelayers +50% mines, Flak +20%, Illumination halves the night sight cut (was removes it), Sapper Teams hold /(1+0.5n) and +25% repair, Vehicle Barriers car bombs x0.75 and vehicles -10%, Anti-Armor +17.5%, Counter-Battery +25%, Aircrew flares /(1+0.5n), +5% fool, heal 12.5%, Fuel Convoy burn x0.85. Instant effects (full rebuild/heal, strike ready now, fresh mines, top-off) unchanged.
- **2x payout ad**: `AD_CAP.x2` = Infinity; still once per AAR (`lastAAR.x2`, in memory only), campaign only, never in the challenge. The button reads "Watch an ad · adds this run's cash again" (no counter).
- **Finish now**: linear 25 gems / 30 min (see Gems above). Refits use the same `labSkipCost`. The cash-pack "value check" (gems as skips) assumed the old curve: a gem now buys 1.2 min of lab time instead of ~6 min, so packs are relatively better value than skips.
- **R&D access**: every line's first tier opens early. Desert gate table (progress = Desert best wave; tier 2+ gates unchanged):

  | Gate | Tier (RP, lab) |
  |---|---|
  | 1 | Infantry Kit T1 (40, 2m) |
  | 3 | Hand Grenades T1 (20, 1m) |
  | 5 | Fort Walls T1 (25, 1m) |
  | 6 | Infantry Kit T2 (70, 31m) |
  | 8 | Minefield T1 (25, 1m) |
  | 12 | Artillery T1 (30, 2m) |
  | 16 | Gun Trucks T1 (35, 2m) |
  | 20 | AA Gun T1 (40, 2m) |
  | 25 | MG Nests T1 (45, 30m) |
  | 30 | Sniper Tower T1 (55, 30m) |
  | 35 | APC Squadron T1 (60, 35m) |
  | 40 | Air Support T1 (70, 35m) |
  | 50 | Tank Platoon T1 (100, 40m) |
  | 52 | Infantry Kit T3 (410, 90m) |
  | 58 | Flame Bunkers T1 (130, 40m) |
  | 60 | Fort Walls T2 (140, 40m) |
  | 66 | Missile Launcher T1 (170, 45m) |
  | 68 | Hand Grenades T2 (180, 45m) |
  | 74 | SAM Site T1 (220, 45m) |
  | 76 | Minefield T2 (230, 50m) |
  | 82 | Attack Helicopters T1 (280, 50m) |
  | 88 | Fighter Jets T1 (340, 55m) |
  | 92 | Gun Trucks T2 (390, 55m) |

  Mountain Pass: Point Defense T1 at 130 (w30), Missile Silo 135 (w35), Gunship 140 (w40): their Armory items open at wave 30/30/35 of a theater. Each gate sits behind the Armory wave that unlocks the item, and a line still shows only once its item is fielded (owner rule). Visible lines on typical Desert saves (`.qa/x_rd.js`): w10 4 (Infantry, Grenades, Walls, Mines; was 2), w22 7 (was 4), w25 8 (was 4), w50 11 (was 7).
  Per theater tiers 23/10/8/12/9/13/13/12, RP 3105/6050/5960/10430/11200/17750/21300/25250 (was 1770/7090/8750/11230/14450/…), tree 107590 -> 101045 RP (-6%), lab 822.7 -> 774.1 h. RP income is unchanged (owner rule 3): the Desert now offers ~3.1k RP of tiers against ~1.9k RP earned there, so the player chooses; Desert+Mountain together cost about what they did (8860 -> 9155 RP).
- **Air Support**: `airBombs(l)` = min(16, 5 + ceil(l/2)) (odd levels +1 bomb), `airRad(l)` = 34 x min(2.5, 1 + 0.08 x (floor(l/2) + levels past the bomb cap)) (even levels +8% blast), `airDmg(l)` = the old growth 60 x 1.25^(l-1) x `late('air',l,1.25)` (x1.298 a level past the knee, level 4) times an extra `AIR_DG`^(l-1) = 1.03^(l-1) x `rMult('air')` (owner decision 2026-10-02, after a literal 1.03-only version proved far too weak). Knobs `AIR_DG`, `AIR_NMAX`, `AIR_R0`, `AIR_RSTEP`, `AIR_RMAX`. The bomb's radius rides on the bomb (`b.r`) into `sigBomb` (blast, armor bite, burn). Card: "7 bombs · 39m blast · 128 dmg · 36s cd".
  Damage per bomb before research, old -> new: L1 60 -> 60, L5 152 -> 171, L10 561 -> 732, L20 7,617 -> 13,357, L38 (Desert cap) 834k -> 2.49M. Fewer bombs than before at a given level (L10: 10 vs 15) offset by the wider blasts and +3%/level.
- QA updated: `t_econ` skip-cost check (linear numbers), `t_adlab` "1h = 50 gems", `t_daily` cap checks moved to the reroll ad + "x2 has no daily cap" + "AAR 2x again next run, no counter" (108 -> 110), `t_merge` gives gems before its two `labSkip` calls (the skip now costs more than the seeded balance), `t_cash` War Bonds scale = 1 + 10 x WB.

## Collapsing perimeter, silo strike, night light map (branch `worktree-agent-aec59798fe36c10d6`)
### Structures fall before the fort (owner: "a last stand when everything around you starts failing till it's only you left")
- Code: new `RAID` knobs `esc` 8, `spill` 3, `spe` 0.7, `ease` 0.9, `guard` 2.5 and `shEsc`/`shWeak`/`shStrain`/`shSpill`/`shGuard`/`shDmg`/`shFell` right after `shArty`; hooks in `damageFort` (spill on a wall hit, guard when the walls are down), `startWave` (strain eases), `destroyDepot`/`destroySite` (`shFell`).
- **Strain** `G.shS` = the deepest the walls have been pushed this stretch (1 = breached), ratchets up on every fort hit, x`ease` per wave. Raider pick chance and the artillery share (cap 60%) are x`shEsc()` = 1 + esc x strain, so a fort that is starting to crack sees its perimeter raided hard while a healthy fort (strain ~0) plays exactly as before.
- **Spill**: every hit on the walls also lands `spill x strain^spe` of itself on the weakest standing structure (weakest first, so they go one after another).
- **Guard**: with the walls down, a hit that would reach the fort's own health lands on the weakest standing structure instead (`guard` x the share of fort health it would have cost). The keep only bleeds once the perimeter is gone.
- Feed "PERIMETER FALLING · n of m structures lost" per loss, the yard banners are now `crit`, and when the last structure falls a crit banner **LAST STAND** "The perimeter has fallen · only the fort remains" + 8 s Rapid Fire (`G.lsT` = wave). `G.lastStand` (walls breach, 3-star logic) is untouched.
- Raiders standing at a structure are revealed (`e.rev`): a sim found a hidden shooter sieging a hardened hangar out of sight, stalling a wave forever.
- No RNG draws were added (spill/guard are deterministic), so saves without structures replay bit for bit: `t_par` identical.
- Numbers (t_basehp sims, 4 seeds x 3 plans x 3 structures; "fell first" = built structures lost before the fort in runs where the fort fell):
| Fort | fell first before -> after | fort mean death wave neglected / typical / hardened, before -> after | waves fought without them (after) |
|---|---|---|---|
| Desert f0.4 (~w41) | 22/36 -> 36/36 | 40.3/40.8/41.3 -> 40.8/41.3/41.8 | 0-5, mostly 1-3 |
| Desert f0.55 (~w57) | 27/36 -> 36/36 | 56.8/56.8/57.8 -> 57.8/56.3/57.0 | neglected ~5.5, typical ~1, hardened ~1.5 (hardened still reach w50 12/12) |
| Capital f0.55 (~w39) | 12/36 -> 36/36 | 39.3/39.0/38.8 -> 39.3/38.8/39.3 | 0-2 |
- QA: `t_basehp.js` unit 38 (new section 9: no strain on a fresh run, strain from a wall hit, spill only onto the weakest, next to no spill with whole walls, strain eases, raids escalate, the guard shields the keep, one-by-one falls + feed, LAST STAND marker, then the keep takes hits). Sims print `ORDER fell-first a/b`, mean end per plan and check >= 90%; "hardening pays" now compares the mean wave a structure is lost; strained forts check "hardened hold until the last 3 waves" (was "hardened mostly hold"). Keep sims to 1-2 seeds per call (4 seeds of Desert f0.4 now pass 140 s). `t_diag.js` = per-wave fort damage / wall min / structure HP / damage sources.

### Missile Silo (owner: "for 35k it doesn't feel like a good purchase")
- `SILO_R` 175 (was 95; x1.84; the rod tier's radius x2 gives 350), `SILO_D` 2400 base (was 320; x7.5): L1/L3/L5 = 2400/4056/6835 before research (was 320/541/911). Missile drawn `SILO_VS` 2.6x, bigger trail/launch cloud; `siloImpact`: full-radius damage, white-hot core, 3 shockwave rings, 6 fireballs, 70 sparks, a smoke column that hangs ~10 s, scorch field, burning emitters (High), flash 0.5, shake 22 (past the usual cap of 12) + 1.6 s rumble (`siloAft`), heavy haptic. `bestCluster` aims with 0.8 x SILO_R. Bomblets/EMP/rod all read `siloR()`.
- `t_silo2.js` (seeded run, every strike counted): Desert f0.45 silo L8: killed 40%/44%/8% of what it caught in w30/35/40 (2.5-3 caught) -> 100%/100%/75% (4.5-7.5 caught); Mountain f0.45 L9: 26%/14%/11% -> 97%/70%/42% (7-16 caught). Fort death wave +1 in both.

### Night light map (owner: "weird low res lighting at night", iPhone, Desert w10)
- The phone High light pass (`dnLite`) used a 1/5 CSS-res buffer (78x169 on a 390-wide phone) stretched ~10x: blotchy pools and smeared dark patches. `dnQ()`/`dnBuf()`: phones 1/2 CSS px at AQ level 0 (195x422), 1/2.5, 1/3, 1/4 as the governor steps down; desktop 1/2.5 (was 1/5 light map, 1/4 glow). The final stretch uses `imageSmoothingQuality='high'` (reset to 'low' after). ChaosGL never records lmap/glow (min 1e9), so both renderers share the Canvas2D buffers; checked with GL on and off (`t_night.js`, no errbox).
- Cost: WebKit iPhone 13 profile (software rendering, so only relative): light pass 20.8 -> 30.3 ms of a ~240 ms frame. `wk_night.py <src> <png> [aq] [gfx]` takes the screenshot and prints the timings.


## Air-defence counters + wave-60 walkers (branch `worktree-agent-a0faf81e3e4cd449d`)
Owner request: enough enemy units to counter a player who invests in air (mobile AA, SAMs, fighters that dogfight), and four-legged robotic walkers replacing the ground force from wave 60.
- **SPAAG** (`ET.spaag`, hp 190, arm .45, rew 56, range 100, vehicle roster from wave 20, `VEH_COST` 3): tracked twin 35mm. `aavTick` (enemy loop, fires on the move, never stalls the advance) shoots 6-round flak bursts (`spgRound`) every 1.9 s at the nearest of your airborne craft (`G._ca`) within 320; about half the rounds hit for `fcHitP` = wall-sized damage + `SPG_PCT` 1.5% of the aircraft's max HP (aircraft HP grows with Armory levels, so a flat hit never dents it: MANPADS-size damage measured ~0% of a maxed heli). Each burst reveals it. Walls: `EFIRE.spaag`, weak. Turret slews to its target (`e.aaA`: `drawVehHQ` rotation, `drawAavLo`).
- **SAM TEL** (`ET.samtel`, hp 240, arm .4, rew 95, roster from wave 30, cost 4): standoff (`stand:30`, parks in the fog, never fires at the walls). One radar missile per ~8 s at aircraft within 560 (`seekerAt`; radar rounds only spoofed by chaff: 22% heli / 35% jet when dispensers are ready; hit = dmg + `SAM_PCT` 16% of max HP). Moves up into view after 3 launches (`e.fwd`). With no aircraft in reach it may fire an interceptor at one of your launcher missiles in flight (`samIntercept`, 75% kill; ATGMs and the silo are never targeted). WARNING strip + HP bar (`trackBoss`, `BOSS_NAME.samtel`), `SAM` bracket when revealed; `threatK` 0.2 for both AA vehicles.
- Both only roll when `flyingCraft()` (checked before any RNG draw in `vehWave`: Desert parity untouched), scaled by `airK()` = 0.35 + 0.19 per aircraft you own (x0.54 for one, x1.5 at six+). Theater `TWS.veh`: Capital spaag 1.4 / samtel 1.5, Island 1.3 / 1.4, Jungle spaag 1.2. `VEH_CALL` callouts; feed `WARNING · ENEMY SPAAG INBOUND`.
- **Enemy fighter** (`SKY.efighter`, hp 120, spd 205, rew 55, from wave 24, weight 0.45 → 1.6, only when `flyingCraft()`; mix Capital 1.5, Island 1.3, Jungle 1.2): `aiFighter` lead-pursuit dogfight with turn limits vs the nearest airborne craft: cannon in a 0.24 rad cone inside 170 (`EFG_PCT` 0.8%/hit), heat-seeker every ~6.5 s at 90-380 (flares as for MANPADS, `AAM_EPCT` 10%). No target, or 40 s on station: strike passes (`jetRun`), then egress. Feed `WARNING · ENEMY FIGHTERS INBOUND`. Your **fighter jets** break off patrol to engage (`dogPick`, state `'dog'`, `jetDog`: pursuit, cannon in a 0.3 rad cone, AAM every 5 s, 14 s cap); CAP, AA guns, SAM sites, CIWS and helis engage it like any aircraft.
- **Walkers** (`ROBO_W` 60, `roboP` 15% → 92% by wave 70, one draw per ground spawn from wave 60 only): `roboMake` sets `e.robo` 1 (infantry roles) / 2 (vehicle roles, MBT boss included; not SPAAG/SAM or amphibians). The type is kept, so stats, behaviour, bounty, `ARMOR_KILL`, `dqKill`, medals and `COUNTER` stay those of the replaced unit; plating a touch heavier (light arm 0.12, heavy +0.05). Art: `roboArt` (8 trot frames + stand, legs reach fore/aft with arched knees, sand dorsal plate, red ID stripe, red eye, `ROBO_ROLE` weapon on top), `roboSpr` baked per preset/zoom, `drawRobo` for every preset and the intel card, `drawRoboWreck`, night lamps (light walkers join `dnRigs`, capped at 40) + eye glow, `roboKillFx` (sparks, no blood). Intel `robo_lt` / `robo_hv`; feed `WARNING · ROBOTIC WALKERS INBOUND`.
- QA (`.qa/`): `t_new.js` (`HASH=#<map>~<wave>~<secs>~<invincible 1|0>[~air[~ground share]]`: spawns, kills, walkers, aircraft damage by source as max-HP fractions, dogfight seconds, SAM shots, all three gfx paths), `wk_new.py <tag> <gfx> <hour|off> <zoom>` (WebKit iPhone shot of every new unit), `batch.py <src> <log> <reps>` (smoke configs in sequence, one browser at a time). Regression tests unchanged and green; `t_par` identical.

## Audio engine (sound design overhaul, branch `worktree-agent-ab514bec7f01b4002`)
Owner: "re work sound design and make the sounds sound really really good, like top tier awesome". No sample files: every effect is synthesised procedurally (zero licensing risk, zero download size) but now **baked**: rendered sample by sample once per variant into an AudioBuffer, then played as one BufferSource per sound. Richer than the old live oscillator/filter layers and cheaper per shot.

### Pieces (all in the AUDIO section of index.html)
- **DSP kit** (`b*` functions, pure JS on Float32Arrays at `BSR`): noise (white/pink/brown `bNz`), envelopes (`bEnv`, sized layers `bNE`/`bSE` render only while audible), sine glides `bSin`, RBJ biquads with gliding or time-function cutoffs `bBq`, tanh saturation `bSat`, modal metal `bModal`/`bClank`, Poisson debris/crackle `bDebris`, rolling AM `bRoll`, supersonic N-wave `bNw`, finish/trim `bFin`, seamless loops `bLoop`. Audio has its own RNG `aR()`/`jit()`; it never touches the seeded `Math.random` (exceptions below).
- **Recipes** `SREC[name]={v:variants, r:bake rate, f}`: guns via `bGun(GUN[k])` (crack, muzzle blast, high snap, gas body, chest thump, EM zing / barrel ring, pink tail, action clatter), explosions `bBlast(k)` (crack, blast body, crunch, mid punch for phone speakers, sub drop, rolling rumble, two debris layers), `bNuke(k)` (multi-stage, pressure wave, cook-offs, long thunder), rocket motors `bMotor`, doppler flybys `bFly` (jet: turbine whine + roar + afterburner crackle; plane: prop blade buzz), plus impacts, UI cues, event stings and the rotor/diesel ambience loops. Default bake rate 32 kHz, long low-heavy sounds 24 kHz.
- **Bank**: `sbGet(n)` bakes one variant on first use and queues the rest; `SB_PRIME` queues everything common when the AudioContext is created (first tap); `sbIdle(ms)` drains the queue from `audioFrame` (6 ms/frame in menus, 2.5 in battle). `sbWant(n)` prefetches (current rifle tier during runs, the silo-strike blast when a silo launches). Whole bank ~1.2 s of JS on a desktop; ~14 MB of buffers with one rifle tier baked.
- **Player** `pv(name,gain,x,y,{prio,rate,send,delay,bus,len,lp,sweep,pan})`: random variant (never the same twice), +-3.5% rate and +-10% gain jitter, distance attenuation + air-absorption lowpass + more reverb with range, stereo pan, flyby pan sweeps, `len` cuts a CIWS burst to length. Caps unchanged in spirit: `AU_FRAME` 8 per frame, `AU_LIVE` 30 live (prio sounds skip them).
- **Graph** (`auGraph`): sfx (small arms, impacts) + amb -> `AU.duck` -> mix; big (explosions, heavy guns) and ui -> mix; every voice also sends to `AU.rev` -> 150 Hz HP -> one ConvolverNode with a generated outdoor IR (`auIR`: early reflections, short bright tail darkening fast, two far slaps) -> mix; mix -> glue compressor -> limiter (-3 dB, 20:1, 1 ms) -> soft clipper (`auClipCurve`, ceiling 0.98) -> master (`S.set.vol`). Music: mbus -> `AU.mduck` -> speakers (still independent of the effects volume).
- **Ducking** `duck(db,hold,rel,mus)`: small arms + ambience dip under tank shots (-2.5 dB), big booms (k>=1.6), breach (-6), silo launch (-4) and the nuke/silo strike (-8/-11 dB, music too at half depth).
- **sfx names** (call sites unchanged except): `sniper` (sniper team, was `shot`), `eshot` (enemy riflemen, AK-pattern; was `shot2`), `clear` (wave-clear cue, was two tones), `storm`/`swarm` (event stings, were live-synth), silo strike = `sfx('nuke',x,y,2)` (bigger, longer, music duck, two delayed thunder rolls). The main rifle follows the Infantry Kit tier (`GUN_TIER`: pistol, carbine, DMR, 6.8 battle rifle, gauss, coilgun, pulsed laser, rail rifle); the squad plays the same era lighter. Big booms get a delayed far-thunder roll (`rumb`), later with range. `tone()` is now a soft sine pluck with an octave partial (square-wave chiptune gone; 'sawtooth' = convoy horns).
- **Ambience**: wind + slow gusts (node noise beds), crickets at night (unchanged gains), baked helicopter rotor loop (blade slap + turbine, rate rises with helis) and enemy-armour loop (diesel pulses + track clatter), and during runs a far-off war every 6-16 s (distant rumbles / muffled MG bursts, filtered and wet).

### Parity note (important)
The old engine drew from `Math.random` in two places the seeded Desert sim hits: the bed-noise buffer made when `startRun` -> `audioUnlock` creates the AudioContext (sampleRate*2 draws) and the live-synth storm/swarm stings (4 / 2 draws). The new engine keeps exactly those draws (`AU.nb` still uses `Math.random`; `auCompat(n)` replays the sting draws) so `t_par` stays `w21 k887 hp-24673 ... bank1019576 ... ex1101626`. Everything else in audio uses `aR()`. If you ever drop them, t_par's baseline changes for an audio-only reason (proved with `.qa/t_trace.js`, which prints the Math.random count per second of the midsim).

### Tuning + QA (`.qa/`, gitignored)
- Edit the AUDIO section of index.html directly (the DSP kit + recipes sit between the `// ==AUDIO-DSP==` and `// ==AUDIO-DSP-END==` markers, so Node tools can load them without a browser).
- `python au_test.py [filter...]`: Playwright Edge, one browser; renders each sfx offline (OfflineAudioContext, `AU.off`) through the real chain and prints peak / RMS / max 50 ms RMS / length / band energy split / bake ms, writes `au_res.json`. `python tune.py` nudges the `SG` gains in index.html toward per-sound targets (50 ms RMS); run test+tune 2-3 times (variants make each render differ by ~1 dB). `python au_bench.py` = main-thread cost per sfx() call vs `base.html` (old build: `git show bdb6c4a:index.html`). `node node_bake.js` = bake time + memory per recipe in Node; `node node_cent.js <recipe>` = centroid/level over time (doppler checks).

### Loudness (offline render through the full chain at 100% effects volume; dBFS; "50 ms" = loudest 50 ms RMS, the loudness the tuner targets)
| Category | Sounds (50 ms RMS) | Peaks |
|---|---|---|
| UI | buy -25, deny -25, cash -24, tone() -26, wave clear -21, wave start -15, boss klaxon -16, game over -13 | -22 to -4 |
| Small arms | pistol -21, carbine -17.5, DMR -16, 6.8 rifle -13, gauss -15, coilgun -14, laser -16, rail -12, squad -22.5, enemy AK -21, MG -19, sniper -15 | -12 to -4 |
| Heavy guns | 40 mm launcher -19, autocannon -14, CIWS -14, mortar -17, tank -12, howitzer -9 | -13 to -2 |
| Explosions | grenade -13, shell -10, heavy -7.6, bomb -7.2, nuke -6.5 (7.5 s), silo strike -6.5 (9 s, music ducked) | limiter, about -1 |
| Missiles / air | ATGM/SAM launch -15, rocket -16.5, flare -21, silo launch -7, jet flyby -10.5, transport -13 | -8 to -1 |
| Impacts | enemy death -24, ricochet/armor -21, wall hit -19, fort hit -14, breach -9.4, APS intercept -20 | -18 to -1 |
| Ambience (battle) | one heli rotor -30, 3 tanks -26, wind -29, far-off war -28 to -30 | -18 |
| Stress | 60 MG/rifle shots + 8 shells in 4 s: -7.2, peak -1.1; that + silo strike + 6 heavy booms: -6.2, peak -0.9 (no clipping) | |

## Theater bosses (branch `worktree-wf_27825535-dcf-1`)
Owner-approved: one signature boss per theater. Code: `// ================= THEATER BOSSES =================` (just before BATTLEFIELD EVENTS): table `TBOSS`, knobs `TB`, `tbSpawn`/`tbArm`/`tbTick`/`TBX` (specials)/`tbPhase`/`tbSky`/`tbHurt`/`tbWpPos`/`tbTap`/`tbHold`/`tbWpHit`/`tbDown`/`tbRout`/`tbFlee`/`tbFleeSky`/`tbFx`; art `TBART`/`tbSpr`/`drawTb`/`tbChar`/`tbWpDraw`/`tbLamps`/`tbBeams`/`tbShadowSky`/`drawTbDead`/`tbPreview`; HUD `hudTbBar`; sounds `SREC.tbin`/`SREC.tbph` (`SG.tbin`/`SG.tbph`). Hooks: `startWave` (spawn + banner + sting prefetch a wave early), `skyWaveStart` (no gunship on 75), `vehWave` (half escort on 75), `kill` (`tbDown` instead of airDown/fxKill/MBT banner/corpse), `hurtEnemy` (`tbHurt`), `fire` (weak point), enemy loop / `updateSky` (rout, `tbTick`/`tbSky`, intel key `tb_<id>`), canvas mousedown (`tbTap`), `vehEnemy` (a boss never stops to duel your vehicles), SAM `focus` (a capped boss doesn't soak the whole salvo), AA max-HP `pct` x`TB.pct` vs bosses. New declared fields on enemies/aircraft: `tb, tbN, tbS, rout`.

### Who, when
| Theater | Boss | Type | Phases (50/100; the 75 light form = phase 1 + phase 3) | Weak point |
|---|---|---|---|---|
| Desert | SCORPION WAR-RIG (tractor + fuel trailer, ram plow) | ground | HMGs + rocket pods / calls its convoy / ramming speed | rear fuel valve |
| Mountain | VIPER ACE (attack heli, shark mouth, kill marks) | air (`aiHeli`) | gun runs + rockets / dashes + flares + flak at your aircraft / drone pack | turbine |
| Coastal | LEVIATHAN (hovercraft, comes off the sea arc) | ground | deck guns + rockets / troops ashore / rocket deck | stern lift engine |
| City | GOLIATH (super-heavy twin turret) | ground | turrets / smoke + reactive armor (shield) / overdrive charge | engine deck |
| Arctic | GLACIER (4-track artillery crawler) | ground | howitzer barrage / + rockets / closes for direct fire | magazine hatch |
| Jungle | MARSH STALKER (hexapod) | ground | gun pods / hunter pack + drones / leaps at the walls + stomps | back reactor |
| Island | NIGHTSHADE (night gunship, searchlight) | air (`aiBoss`) | side guns + 105mm / searchlight + paratroopers / ECM shield + drones | hot engine |
| Capital | COLOSSUS (titan mech) | ground | arm cannons + stomp / missile pods + shield + drones / core exposed: beam sweep | chest reactor (x1.5 in phase 3) |
- Waves (`tbForm`): 50 = full 3 phases (replaces the MBT), 75 = light 2 phases (replaces the heavy gunship), 100 = climax and the theater's clear (Capital 100 = finale: x`TB.fin` 1.4 HP, "FINAL BATTLE" feed). Ground bosses ride type `'boss'` (MBT rules, Tank Hunter, daily tank/vehicle missions), air ones `'airboss'` (AA, Giant Killer). Nothing runs before wave 50: **Desert parity untouched** (`t_par` identical).
- Phases at 2/3 and 1/3 HP (1/2 on 75): crit banner `<NAME> · PHASE n` + the phase line, shake (none with Reduced Motion), haptic, sting `tbph`. Entrance: wave banner `WAVE n — <NAME> INBOUND` + tag line, the WARNING strip held `TB.warn` 2 s longer, sting `tbin` (war horns over drums), intel card `tb_<id>` on first sighting.
- Weak point: tap / hold the glow (`tbTap`, 22 px slack on phones) → the commander's rifle does x`TB.wp` 2.5 for 1.2 s (holding refreshes it); gold tracer to the glow, "WEAK POINT ×2.5" float. Auto-fire / bot never gets it.
- Death: chain blasts 1.35 s (+0.35 on 100), then the big one (`sfx('nuke')`, flash, scorch) and a charred wreck (`G.tbWr`, smokes 60 s, fades by 90 s). Slow motion: `slowMo(TB.slowT,TB.slow)` (1 s at 0.3x, the shared feel-pass slow-mo; the branch's own `G.slowT` loop scaling was removed in the pre-launch merge), skipped with Reduced Motion. Wave-100 kill = `tbRout`: spawns cancelled, the rest of the wave flees (bounty only if you shoot them; a router pinned on a building melts after 12 s).
- Reward: bounty `TB.rew` [3,5,9] x an MBT bounty; RP `TB.rp` [0,2,3] (x2 for Capital 100) only the FIRST time per theater + wave (`S.tbk`), never in the daily challenge. Medal **Titan Slayer** (`st:'tboss'`, ranks at 4 / 12).

### Balance (`TB`)
HP = `TB.hp` [2.4, 3.2, 6] (75/50/100) x theater `hp` x the MBT's (air: the gunship's) wave HP; damage `TB.dmg` [1.1,1.05,1.35] x MBT (wave 50 was 1.2, lowered in review); specials `mg` 0.035 / `rk` 0.25 / `ar` 0.5 / `lz` 0.7 / `st` 0.8 / `ram` 3 of boss dmg. Damage cap (`tbHurt`): past `TB.cap` [4%, 3.3%, 2.5%] of max HP in one sim second only `capX` 4% of the excess lands (weak-point hits always land in full), so an overbuilt fort or a full SAM battery still gets a ~30-45 s fight. `TB.run` 2.2x speed until in sight. Drawn `TB.sc` 1.45 x `bS()` (towers over line tanks).
Bot (t_tb sims: auto-fire only, every Armory line at f of the theater cap, deployed the wave before):
| Fort | Without (MBT / gunship) | With the boss |
|---|---|---|
| Desert f0.55 w50 (clears ~w57) | MBT ~30 s | killed 32-38 s (96.5M HP), phases ~17/31 s, walls min 0.35-0.84 |
| Desert f0.50 w50 (falls ~w51 anyway) | holds w50 | falls at w50, boss at 72% (1 wave earlier) |
| Desert f0.95 w100 (f0.9 falls at w100 even without) | MBT 25 s, walls 0.99 | killed 56-59 s (38.8B), phases ~36/50 s, walls 0.81-0.89; f0.92: 1 of 2 holds (98 s, breached) |
| Mountain f0.6 w50 (Viper, air) | walls 0.97 | killed 25-26 s, walls 0.77-0.83 |
| Mountain f0.975 w100 (f0.95 falls) | MBT 57-67 s, walls 0.93 | killed 31-35 s (511B, cap-bound), walls 0.72-0.92 |
| City f0.7 w50 (f0.65 falls at w49) | MBT 45 s, walls 0.99 | killed 72-79 s, walls 0.48-0.78 |
| Capital f0.75 w50 (f0.7 barely holds) | - | killed 48-50 s, walls 0.89-0.95; f0.7 falls at w50 |
City/Capital w100 can't be cleared by the bot even at the caps (it never uses airstrikes / grenades), so no w100 bot numbers there.

### QA (`.qa/`, gitignored)
- `t_tb.js` (PRE=pre_seed.js): `HASH=#unit` 195 checks (spawn on 50/75/100 in all 8 theaters, air/ground, names, no MBT/gunship beside it, every preset draws, intel preview, HP scale, phases, weak point x2.5 + tap rule, shield, damage cap + weak point bypass, bounty/RP once/medal/slow motion/reduced motion, wreck, wave-100 rout, air death, 40 s live per theater). `HASH=#sim~<map>~<f>~<w0>~<seeds>[~<w1>[~off[~knobs]]]` = the bot table (`off` = TB.on 0; knobs like `hp1=3,dmg2=1.2,mg=0.03`); keep 2 seeds per call (<150 s).
- `wk_tb.py <maps|all> [gfx] [hour|off] [zoom] [port|land] [bar|warn|phase3|dead] [wave]` (env ANG = placement angle) and `wk_tbgal.py [night] [dead]` (art gallery of all 8). Checked 390x844 / 844x390: the bar (54 px) sits under the status card, clear of the controls.
- `au_test.py tbin tbph` (spec lines added to the local copy): tbin ~-14.8 dB (50 ms), tbph ~-12.3.
- Regression unchanged: t_core 57, t_econ 82, t_daily 110, t_adlab 62, t_merge 45, t_fort 23, t_tw 20, t_cash 69, t_store 52, own OK, t_basehp 38, t_par identical. Smoke Desert maxed w104 (all three bosses down), Island / Capital maxed kill the w50 boss, cw=0.

### Review fixes (same branch, independent review 2026-10-03)
- **Bosses raided structures**: `tbSpawn` reset `e.dep`/`e.fsite` to `undefined` (= "not decided yet"), so `depotEnemy`/`siteEnemy` could still roll a raid and park the boss at the depot / motor pool / hangar, out of reach of the walls (City f0.7 seed 1: boss never fired on the walls, dmin 308). Now `dep=false`, `fsite=null`.
- **Execute research finished bosses**: `sgExecute` (Robotic Smart-Rifle Post 15%, Coyote `executeAir` 20%) killed a boss below 15-20% HP, skipping most of phase 3. Theater bosses are exempt.
- Because both bugs had softened the bot table, `TB.dmg[1]` (wave 50) went 1.2 -> 1.05. Re-measured (t_tb sims): Desert f0.55 w50 killed 42-43 s, walls 0.30-0.45; City f0.7 w50 74-75 s, walls 0.27-0.30; Desert f0.95 w100 (dmg 1.35 unchanged) 59-70 s, walls 0.49-0.57 (was 0.81-0.89 with the bugs); Desert f0.75 w75 42-43 s, walls 0.85; Mountain f0.6 w50 32-33 s, walls 0.73-0.86; Capital f0.75 w50 56-62 s, walls 0.98; Arctic f0.78 w50 42-45 s, walls 0.96 (Arctic f0.7 falls at w51 without the boss, at w50 with it).
- **ChaosGL demotion**: live boss parts used polygon / roundRect / gradient fills, which ChaosGL can't draw, so every frame a Colossus (also Leviathan, Glacier; Nightshade searchlight in the sky layer) was on screen the rest of the ground layer fell back to Canvas2D. Colossus feet are now a baked sprite (`TBART.titan.foot`); fan blades / hubs / radar / searchlight use lines, rects and ellipses only. Rule for future art: live (per-frame) parts may use only `limb`, `box`, `ell`, arcs and sprites.
- Boss specials credited `damageFort` to `'boss'` even for the air bosses (AAR cause + counter picks said MBT); they use `e.type` now (`airboss` for Viper / Nightshade).
- Leviathan's reinforcement call waits until it is ashore (`seaIn > -12` postpones it 1.5 s).
- QA: `.qa/t_rv.js` (PRE=pre_seed.js): `#track~<map>~<f>~<wave>~<secs>~<seed>` (boss can't drop below 5%: position / range / phase every 5 s), `#rout~<map>` (wave-100 kill -> wave 101 starts, 7.4 s on Desert), `#old` (old save -> `S.tbk` + Titan Slayer saved), `#perf~<map>~<gfx>` (200 enemies + boss: draw ms and ChaosGL demotions; all 8 theaters now `{}`).

## Game feel pass (branch `worktree-wf_27825535-dcf-2`)
Owner-approved: low-health warning, haptics, slow-motion moments, run stats on the AAR. The code sits in one block `// ---- GAME FEEL` right after `shake()`, plus small hooks.
- **Low health** (`LOWHP` 0.25, `lowHpK()`, `drawLowHp()`, beat clock `HBT`): under 25% of the fort's own health (walls don't count) a red radial vignette closes in from the edges, stronger as health falls, pulsing "lub-dub" with a heartbeat that quickens from 1.0 s to 0.55 s a beat. It replaced the old <30% red border stroke. Wall-clock, driven from `draw()`: it never touches the sim. No beats while paused or in the perk menu; it stops when health climbs back or the run ends. Reduce motion: a steady tint, no pulse.
  - Sound `heart` (`SREC.heart`, 2 variants, in `SB_PRIME`): sub thump + 2nd/3rd-harmonic knock, saturated, 1.1 kHz lowpass, so 35-46% of its energy sits in 120-500 Hz (phone speakers). `sfx('heart',null,null,k)` on the effects bus (`AU.sfx`, so it dips under the duck), prio 2, gain `SG.heart` 0.2 x k (k 0.7-1.2 with depth): 50 ms RMS -19.8 / -16.0 dBFS, under the fort-hit `hurt` (-14.5). `.qa/au_test.py heart` has the two specs.
- **Haptics** (`hapt(kind,key,gap)` = `Plat.haptic` rate-limited per key on the wall clock): fort hits (light on walls, medium on the keep, one per 1 s shared since the pre-launch merge), big blasts near the fort (`boomFx` r>=28 within fortHalf+150: medium, heavy at r>=70, 140 ms), wall breach (heavy), structure lost (`shFell`, heavy), LAST STAND (heavy), boss warning (`trackBoss`, warning: only MBT / heavy-gunship boss waves and theater bosses, not SAM launchers), MBT / heavy gunship kills (heavy), silo strike (heavy), wave clear (success), Armory buy (medium), research start (success). Settings → DISPLAY → **Haptics** (`S.set.haptics`, default on, `#hapRow`/`#sHap`): `Plat.haptic` returns at once when it is off. The row is hidden on the web when there is no `navigator.vibrate` (iOS Safari: haptics are a no-op there anyway); the web path still also needs Screen shake on, as before.
- **Slow motion** (`slowMo(dur,k)`, `smK(now)`, state `SM`): eases to k over the first 15%, holds, eases back over the last 45%, on the real clock. Only `loop()` uses it, multiplying the accumulator (`* smK(now)`, never > 1, so it can only slow the player's battle speed). `update()` never sees it, so the headless harness, `t_par` and smoke are unaffected. Skipped with Reduce motion; a weaker or shorter call never cuts an active one. Calls: silo impact 1.1 s x0.3 (`siloSlow`: first impact of a wave only, at most once per 60 real s), perimeter LAST STAND banner 1.2 s x0.3, first wall breach of a run (the LAST STAND rapid fire) 0.9 s x0.35, MBT boss / heavy gunship kill 0.8 s x0.4. Other features can call `slowMo(dur,k)`.
- **Run stats** (`G.st` = `{d, ks, k, big, bs, bt, wc, w0}`, `_ds`, `statHit`, `statKill`, `statCls`, `STAT_SRC`, `STAT_CLS`, `statsHtml`): `_ds` is the damage source of the hit being dealt, set around each system in `update()` the way `_dk` is (rifle, squad, nade, arty, air, mines, wire, ddef; per unit `u.k` in `updateUnits`/`updateAir`/`sigUpdate`; tank/APC/heli/gunship shells by `s.id`; missiles carry `m.ds` from `mslNew`; SAM/fighter AAMs `m.ds` from `sgAam`; flak `aagun`; silo nukes `silo`; jets `fighter`; loitering munitions/bomblets carry `ds` in `G.sgl`). `hurtEnemy` adds the damage that actually landed (capped at the target's hp) per source and tracks the biggest single hit; `kill` counts kills by source and by class (Infantry, Vehicles, Tanks, Aircraft, Bosses, Walkers). Plain object adds per hit, no RNG: `t_par` identical. `snapAAR` copies it; the gold AAR gets a collapsible **RUN STATS** (`details.rund.rstat`, open state kept in `_rsOpen`): waves held / damage tiles (time and cash were dropped: the AAR header shows them), TOP KILLER (most kills) and BIGGEST HIT cards, damage bars by source (top 9 + "n more", two columns from 700 px), kills by enemy class.
- QA (`.qa/`, gitignored): `t_feel.js` (37 checks: haptics toggle/gate/rate limits/hooks, slowMo curve + reduce motion + loop-only, heartbeat start/spacing/faster when lower/paused/stop, stats add up to G.kills, labels, AAR section + open state). Run: `PRE=pre_seed.js VT=60000 python h.py dom feel t_feel.js`. `wk_feel.py`: WebKit iPhone 13 shots of the AAR stats (390x844, 844x390) and the low-HP vignette; delete the PNGs after looking.
- **Review pass (same branch, independent reviewer):** exercised every feature headless: heartbeat + slow-mo through the real `loop()` with a fake clock (7 beats in 5 s at 10% HP, 1 s `slowMo(1,0.3)` = 0.50 s of sim, Reduce motion 1.00 s, 2x battle speed untouched, no beats paused or healthy), call counts on a maxed Desert run (2400 sim s: 44 silo slow-mos, 21 boss-kill slow-mos, fort-hit haptics 163, boss warnings 144 rate-limited; damage tagged "Other" 0.1%), WebKit iPhone 13 AAR 390x844 / 844x390 (no overflow) and the vignette. Fix: `slowMo` taking over an active slow-mo restarted its ease-in from 1, so a boss kill followed by a silo strike snapped the game to full speed for a frame and back down; now the ease-in starts from the current factor (`SM.k0`) and a longer, milder call keeps the deeper factor. `t_feel.js` 39 (2 new checks). Perf: maxed smoke 64 ms/2s vs 68 on main (noise). For the owner: with a maxed silo the slow-mo fires about once a minute from silo strikes alone; if that feels too often, gate the `siloImpact` call (e.g. first strike per wave).

## Retention + launch readiness (branch `worktree-wf_27825535-dcf-3`)
Owner-approved: rating prompt, welcome back, reminders, Game Center, iCloud (code path, off), anonymous analytics (off). All of it is in the `// ================= RETENTION` section of index.html (right before `econInit`), plus small hooks. Save: `S.ret = {n sessions, last, rst, nt, rv:{t,n,p}}`; RESET keeps it (like `S.runs`) and stamps `rst`.
- **Sessions** (`retBoot` at load, `retLeave` from `bgPause`, `retBack` on `visibilitychange` visible / `Shell.app.onState(true)`): a session = an app open or a return after `RET_GAP` 30 min. `_retEnd` = wall time the last run ended.
- **Welcome back** (`wbScan`, `wbLive`, `renderWb`, `#wbCard`, CSS `.wb*`): a Base tile (top of the right column; first on phones, `order:0`) after a launch or a 30-min return, **never in session 1** (also not on a veteran's first launch with this code). Lines, each kept only while still true: research landed (`S.lab.news`, cleared by the R&D screen), lab idle (`labFree()` and `rsAffordN()`), today's streak supply, new daily missions (raised when a new day began since the player was last here, kept while a mission is unclaimed), daily challenge unplayed, free-gems ad left. Rows jump (R&D via `data-view-go`, streak sheet, scroll + flash to Daily Ops / challenge); x dismisses. Not a modal.
- **Review prompt** (`rvMoment(why)`, `rvBlock()`, `rvTry()`; `Plat.review` -> `Shell.review.request` -> GameKit plugin `requestReview` = `AppStore.requestReview(in:)` / `SKStoreReviewController`). Moments: a new best on a theater from wave `RV_W` 15 (endRun, not the challenge), a theater's first clear (`campHold`), streak day 7 (`stClaim`). The moment waits (`RV_KEEP` 3 days) for a calm spot: a user navigation (`setView(..,true)`), closing the clear debrief / streak card, a session start. Blocked: sessions < `RV_SES` 3, < `RV_DAYS` 60 days since the last ask, < `RV_CALM` 60 s after a run end (a death), < `RV_AD` 3 min after a rewarded ad or interstitial, in a run, over a modal, `Plat.busy()`. Web: `Plat.reviewOn()` is false, nothing is queued. iOS shows the sheet at most 3 times a year and **never in TestFlight** (the call does nothing there), so it can only be seen in the App Store build.
- **Notifications** (`ntOn`, `ntSend`, `ntPlan`, `ntToggle`, `dayWall`): nothing is scheduled until the first research is started (`S.ret.nt`, set in `labStart`, so iOS's permission sheet appears right after that tap; saves that had researched already get `nt` = 1) and only with Settings -> NOTIFICATIONS -> Reminders on (`S.set.notif`, iOS only). ids: `lab:<line>` research/refit done (unchanged), `labidle` `NT_IDLE` 3 h after the lab runs out of work while RP covers a tier, `daily` tomorrow 19:00 (`dyRemind`; says "Report in today to keep your N-day streak" when the grace day is spent), `streak` 20:00 on the last keepable day when the grace day is unused ("ends tonight"). `ntPlan` re-plans `labidle`/`streak`/`daily` on every trip to the background; Reminders off cancels everything, on puts it back.
- **Game Center** (`PLAT_IDS.lbDaily` = `com.thefort.game.lb.daily`, `PLAT_IDS.achPre` = `com.thefort.game.ach.`, table `ACH`, `gcSync`): 16 achievements: `clear_<theater>` x8 (desert, mountain, coastal, city, arctic, jungle, island, capital), `wave_5/25/50/75/100` (= the Baptism of Fire / Hold the Line / Iron Curtain / Unbroken / Legend of the Fort medals), `kills_2500/25000/250000` (Centurion and its ranks). Reported at 100% after `Shell.configure` and after every run; what Game Center accepted is remembered in localStorage `fortGc` (a signed-out or failed report is retried). The daily challenge card has a LEADERBOARD button and Settings a Game Center ACHIEVEMENTS button (iOS, Game Center on). Empty ids = off. **Master switch `PLAT_IDS.gameCenter` (false since the pre-launch merge):** while false, `Plat.boot` configures the shell with no leaderboards and `achievements:false`, so there is **no Game Center sign-in at launch**, `Plat.gcOn()` is false (no LEADERBOARD / ACHIEVEMENTS buttons, `gcSync` / `Plat.score` / `Plat.board` do nothing). The ids stay defined (so build_www's "PLACEHOLDER lbDaily" CI warning stays gone). Flip it to `true` once the leaderboard + 16 achievements exist in App Store Connect; then sign-in runs at launch (after ATT/consent).
- **iCloud** (`PLAT_IDS.icloud` **false**, `cloudRank`, `cloudBetter`, `cloudPull`, `cloudPush`, key `theFortSave.cloud`; `Shell.cloud` -> GameKit plugin `cloudGet`/`cloudPut` = `NSUbiquitousKeyValueStore`). Pull at launch (after `saveBoot`) and on a 30-min return, push on background and after RESET. Conflict rule: a copy older than this device's last RESET (`S.ret.rst`) loses; otherwise more progress wins, compared in order: theaters cleared, research tiers + refits, sum of best waves, career kills; a tie keeps this device. When the cloud copy wins, this device's save goes to localStorage `theFortSave.bak`, and the larger gem balance and the Remove Ads / Starter Pack flags ride over. **Off because it needs the iCloud capability on the App ID and the `com.apple.developer.ubiquity-kvstore-identifier` entitlement**: adding the entitlement before the portal step would break CI signing (fastlane fetches the App Store profile from the App ID). `check_game.cjs` fails if `icloud:true` without that entitlement line.
- **Analytics** (`AN.track/flush/session/end/once/offer`, `PLAT_IDS.analytics` **empty = off: nothing stored or sent**): random 24-hex install id in localStorage `fortAn` (not in the save), random session id, no device or ad ids; events queue in localStorage (300 max) and POST as text/plain (no CORS preflight) every 20 events and at session start, `sendBeacon` on background. Never touches `Math.random`. Events listed in `tools/analytics/README.md`. Receiver: `tools/analytics/` (Cloudflare Worker `worker.js` + D1 `schema.sql` + `wrangler.toml`; `node tools/analytics/test.mjs`, 13 checks), not deployed.
- **Settings:** Haptics is the feel pass's DISPLAY row (`S.set.haptics`; this branch's duplicate CONTROLS row was dropped in the merge, its `AN.track('setting',{k:'haptics'})` kept); NOTIFICATIONS block (`#natSet`, iOS only): Reminders + Game Center.
- **Native:** `native/shell.js` adds `gc.available/unlock/showLeaderboard/showAchievements`, `review.available/request`, `cloud.available/get/put` (configure takes `achievements`, `icloud`). The local `capacitor-gamekit` plugin gained `requestReview`, `cloudGet`, `cloudPut` (`import StoreKit`; no new package, entitlement or Info.plist change). `check_game.cjs` knows the new Shell members and PLAT_IDS keys; `test_shell.cjs` 94 -> 124 (achievements, screens, signed out, review, cloud). The Swift was not compiled locally (no Xcode on this PC): the first CI build after merging is its compile check.
- **QA** (`.qa/`, gitignored): `t_ret.js`, 88 checks (`python h.py dom ret t_ret.js`): sessions, card lines/dismiss/liveness, review gating + the three hooks, notification gating/plan/toggle/streak times, Game Center (scripted `window.Shell`), iCloud rank + pull/push/.bak/gems, RESET keeps `S.ret`, analytics off/on, envelope, cleaning, batching, beacon, no RNG. Unchanged and green: t_core 57, t_econ 82, t_daily 110, t_adlab 62, t_merge 45, t_fort 23, t_tw 20, t_cash 69, t_store 52, own.js, t_basehp unit 38, t_par identical (curves -2048449059, midsim w21 k887 hp-24673 ... bank1019576 ... ex1101626).
- **Owner steps** before these light up: create the leaderboard + 16 achievements in App Store Connect (ids above); for iCloud enable the capability on the App ID, add the entitlement, flip `icloud:true`; for analytics deploy `tools/analytics` and set `PLAT_IDS.analytics`, then update the privacy label (see its README).

### Review pass (same branch, after the builder)
An independent review of the whole diff, with the new features exercised headless (scripted `window.Shell` in Edge, WebKit iPhone 13 portrait + landscape for the card). Fixes:
- **Streak-warning reminder was unreachable.** `dyRemind` schedules once per day on the day's first Base render, before the streak sheet is claimed, so the "Report in today to keep your N-day streak" text never applied. `ntPlan` (every trip to the background) now clears `S.dy.rem` and re-sends `daily` (same id replaces).
- **Settings rows ignored `hidden`.** `.set` is `display:grid`, which beats the `hidden` attribute, so Haptics (web without vibrate), the Game Center row (Game Center off) and the old **Developer mode** row (web) showed regardless. New CSS `#settings .set[hidden],#natSet[hidden]{display:none}`. Developer mode is now really hidden on the web until the 7 taps on the Settings title, as its code always intended.
- **Achievements re-reported once per app build** (localStorage `fortGcB` = `Shell.build`; a change clears `fortGc`). Re-reporting a completed achievement is a no-op for Game Center, and it heals any report Apple accepted before the id existed in App Store Connect (the builder's open risk).
- **`wbScan` swallowed "Research complete" / "Fort redesigned" toasts** on a 30-min return (it called `labTick` before `labLand` could), and could tick the lab and roll a new day's missions mid-run. It now calls `labLand` + `dyTick` only when no run is live.
- QA: `.qa/t_rvfix.js` (`python h.py dom rvfix t_rvfix.js`): reminder text, `[hidden]` rows, per-build re-report, toast kept. `.qa/wk_rv.py [shot]`: WebKit iPhone 13 portrait + landscape measurements of `#wbCard` (overflow, row heights, order); deletes nothing itself, so remove `wkrv_*.png` after a `shot` run.
- Not changed, worth knowing: iCloud's `cloudBetter` lets the copy with the **newer RESET stamp win outright**, so a RESET on one device wipes the other device's campaign at its next pull (kept in `theFortSave.bak`, one slot). Decide whether that is wanted before flipping `icloud:true`. The review prompt usually waits for the second navigation after a run (the first comes within `RV_CALM` 60 s of the death).

## Pre-launch batch merge (2026-10-03, local `main`, not pushed)
Merged with `--no-ff`, in order: theater bosses (`worktree-wf_27825535-dcf-1`), game feel (`-dcf-2`), retention (`-dcf-3`). Worktrees and branches removed afterwards.
- **Conflicts resolved:**
  - **One slow motion:** the bosses' own `loop()` time-scale (`G.slowT` x `TB.slow`) is gone; `tbDown` calls the feel pass's `slowMo(TB.slowT,TB.slow)`. Only `smK(now)` scales the loop accumulator (never > 1, skipped with Reduce motion, paused = 1), so nothing double-scales.
  - `kill` / `hurtEnemy`: both branches' hooks kept (`tbHurt` before `statHit`; `tbDown` routing + `statKill`; the MBT banner / haptic / slow-mo skip theater bosses). Boss death haptic uses `hapt('heavy','bossk',500)`. SAM hits keep `TB.pct` and reset `_ds`. `SG` / `sfx` keep `tbin`/`tbph` and `heart`.
  - **One Haptics setting:** the feel pass's DISPLAY row (`S.set.haptics`, `#hapRow`/`#sHap`); retention's CONTROLS duplicate (same ids) removed; its `AN.track('setting',{k:'haptics'})` kept on the one handler. Armory buy keeps both the haptic and `AN.track`.
  - `.qa`: all new test files copied from the worktrees; `au_test.py` merged (tbin/tbph + heart specs).
- **Owner-approved fixes (from the reviews):**
  - **Silo slow-mo** (`siloSlow`): only the first silo impact of a wave, and at most once per 60 real seconds. Boss-kill (MBT, gunship, theater boss) and LAST STAND / first-breach slow-mo unchanged.
  - **Haptics:** fort-hit haptic at most once per 1 s (was 250 ms). The boss-warning haptic in `trackBoss` fires only for real bosses (`e.tb`, type `boss` / `airboss`), not for SAM launchers (`samtel`) on the WARNING strip.
  - **Game Center switch** `PLAT_IDS.gameCenter:false`: no sign-in at launch (the shell gets no leaderboards and `achievements:false`), `Plat.gcOn()` false, LEADERBOARD / ACHIEVEMENTS buttons hidden, `gcSync`/`Plat.score`/`Plat.board` no-ops. Ids stay defined, so the build_www lbDaily CI warning stays gone; build_www prints a plain "game center: off" line; `check_game.cjs` requires the key (true/false).
  - **RUN STATS:** TIME and CASH tiles dropped (the AAR header has them; 2 tiles: waves held, damage). Barbed wire now goes through `statHit` with `_ds='wire'` (the same `2*wl*dt`, so gameplay numbers and `t_par` are unchanged): "Barbed Wire" shows in the damage bars.
- **Verified 2026-10-03:** node --check; check_game; test_shell 124; t_core 57, t_econ 82, t_daily 110, t_adlab 62, t_merge 45, t_fort 23, t_tw 20, t_cash 69, t_store 52, own OK, t_basehp 38, t_tb 195, t_feel 47, t_ret 90, t_rvfix 10, t_rv rout/old, t_new desert w60 cw=0, t_par identical; smoke Desert fresh (falls w1) / mid#7 (w46) / maxed (w104), Capital maxed (falls w56; pre-merge main falls at w55 too), all cw=0 errbox=false; music menu -> fight after `deployBtn.onclick()` (Edge over http.server). Not run: `build_www.py` + `check_www.cjs` (no `native/node_modules/@capacitor/core` on this PC; `plat_ids`/`check_ids` called directly print no warnings), the Swift compile (CI only), WebKit iPhone shots of the 2-tile RUN STATS.
- **Owner action list:**
  1. **Game Center:** in App Store Connect (The Fort: Last Stand -> Services / Game Center) create the recurring daily leaderboard `com.thefort.game.lb.daily` and the 16 achievements `com.thefort.game.ach.` + `clear_desert, clear_mountain, clear_coastal, clear_city, clear_arctic, clear_jungle, clear_island, clear_capital, wave_5, wave_25, wave_50, wave_75, wave_100, kills_2500, kills_25000, kills_250000` (each needs a title, description, points, image); enable Game Center on the app version. Then set `PLAT_IDS.gameCenter:true`, push, TestFlight, check sign-in + the two buttons.
  2. **iCloud (optional):** enable the iCloud capability (key-value storage) on App ID `com.thefort.game` in the developer portal, regenerate/refetch the App Store profile, add `com.apple.developer.ubiquity-kvstore-identifier` = `$(TeamIdentifierPrefix)$(CFBundleIdentifier)` to `native/ios/App/App/App.entitlements`, then `PLAT_IDS.icloud:true` (`check_game.cjs` fails if the flag is on without the entitlement). Decide first about the "newer RESET wins" rule (see Retention review pass).
  3. **Analytics (optional):** deploy `tools/analytics` (Cloudflare Worker + D1, see its README), put the https URL in `PLAT_IDS.analytics`, and update the App Store privacy label (anonymous usage data, not linked, not tracking) before that build ships.
  4. Push `main`, run a TestFlight build (first compile of the new Swift).

