# The Fort analytics receiver (deployed 2026-10-05: https://fort-analytics.fort-analytics.workers.dev/e)

A free Cloudflare Worker + D1 database that stores the game's anonymous event log. The game sends nothing until
`PLAT_IDS.analytics` in `index.html` holds this Worker's URL.

## What the game sends
`AN` in index.html (RETENTION section) batches events in localStorage and POSTs them as `text/plain` JSON
(fetch every 20 events and at each session start, `navigator.sendBeacon` when the app goes to the background):

```json
{"v":1,"iid":"<24 hex, random per install>","plat":"ios","app":"1.0","build":"123",
 "ev":[{"n":"run_end","p":{"map":"desert","w0":1,"wave":31,"cause":"tank","dur_s":612},"t":1790000000000,"s":"<24 hex session>"}]}
```

No name, email, IP address, device id or advertising id is sent or stored. The install id is random, lives only in the
app's localStorage (not in the save, the backup code or iCloud) and is new after a reinstall.

Events: `session_start` / `session_end` (`dur_s`, the last one per session counts), `run_start` / `run_end`
(theater, start wave, wave reached, cause = top threat or `retreat`, duration, kills), `dc_start`, `research_start` /
`research_done`, `armory_buy` (id, level), `ad_offer` (a placement's button shown, once a session) and `ad` (placement,
watched or not), `shop_view`, `iap` (sku, ok, cancelled), `theater_clear`, `streak`, `tip` (a battle tip completed),
`funnel` (first time only: `run1`, `run1_end`, `buy1`, `research1`, `dailies`, `w5` ... `w100`), `setting`
(music / shake / haptics / notif), `wb_show` / `wb_tap` / `wb_close` (welcome-back card), `review_ask`, `cloud_pull`, `reset`.

## Deploy (about 10 minutes, free plan)
1. Make a free Cloudflare account, then from this folder: `npx wrangler login`.
2. `npx wrangler d1 create fort-analytics` and paste the printed `database_id` into `wrangler.toml`.
3. `npx wrangler d1 execute fort-analytics --remote --file schema.sql`
4. `npx wrangler deploy` prints the URL, e.g. `https://fort-analytics.<your-subdomain>.workers.dev`.
5. In `index.html` set `PLAT_IDS.analytics:'https://fort-analytics.<your-subdomain>.workers.dev/e'`, push, ship a TestFlight build.
6. Before the App Store submission, update the privacy label (below).

Local check without an account: `node test.mjs` (the Worker against a fake D1).

Free-plan limits (2026): 100,000 Worker requests a day, D1 5 GB and 100,000 row writes a day. A batch is one request
and up to 100 rows; an active player sends roughly 3-6 batches and 60-150 rows a day, so ~700 daily players fit.

## Queries
`npx wrangler d1 execute fort-analytics --remote --command "<SQL>"`

- Daily players: `SELECT day, COUNT(DISTINCT iid) FROM events WHERE name='session_start' GROUP BY day ORDER BY day DESC LIMIT 14`
- Day-1 retention: `WITH f AS (SELECT iid, MIN(day) d0 FROM events GROUP BY iid) SELECT f.d0, COUNT(*) installs, SUM(EXISTS(SELECT 1 FROM events e WHERE e.iid=f.iid AND e.day=date(f.d0,'+1 day'))) d1 FROM f GROUP BY f.d0 ORDER BY f.d0 DESC LIMIT 14`
- First-session funnel: `SELECT json_extract(props,'$.step') step, COUNT(DISTINCT iid) FROM events WHERE name='funnel' GROUP BY step`
- Where runs end: `SELECT json_extract(props,'$.map') map, json_extract(props,'$.wave')/10*10 band, COUNT(*) FROM events WHERE name='run_end' GROUP BY map, band`
- What kills forts: `SELECT json_extract(props,'$.cause') cause, COUNT(*) FROM events WHERE name='run_end' GROUP BY cause ORDER BY 2 DESC`
- Ads offered vs watched: `SELECT name, json_extract(props,'$.k') k, SUM(COALESCE(json_extract(props,'$.ok'),1)) FROM events WHERE name IN ('ad_offer','ad') GROUP BY name, k`
- Purchases: `SELECT json_extract(props,'$.sku') sku, SUM(json_extract(props,'$.ok')) bought, COUNT(*) tries FROM events WHERE name='iap' GROUP BY sku`

Keep it small: `DELETE FROM events WHERE day < date('now','-180 days')` now and then.

## App Store privacy label (App Store Connect → App Privacy)
Turning this on adds, on top of what AdMob already declares:
- **Usage Data → Product Interaction**: collected, **not linked to the user**, **not used for tracking**, purpose **Analytics**.
- **Diagnostics**: not collected by this log (no crash data).
- **Purchases → Purchase History**: the `iap` event says which pack was tried and whether it went through. Declare it
  too (not linked, not tracking, purpose Analytics) to be safe, or drop the `iap` event from `Plat.buy` and skip it.
Nothing else changes: no contact info, identifiers, location or diagnostics are sent. The app's `PrivacyInfo.xcprivacy` would then list `NSPrivacyCollectedDataTypeProductInteraction`
(and `NSPrivacyCollectedDataTypePurchaseHistory` if the `iap` event stays), not linked, not tracking, purpose
analytics.
