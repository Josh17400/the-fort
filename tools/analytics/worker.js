// The Fort analytics receiver: a Cloudflare Worker that writes the game's anonymous event batches into a D1 (SQLite) table.
// The game (index.html, AN in the RETENTION section) POSTs text/plain JSON once PLAT_IDS.analytics holds this Worker's URL:
//   {v:1, iid:'<24 hex, random per install>', plat:'ios'|'web', app:'1.0', build:'123',
//    ev:[{n:'run_end', p:{map:'desert', wave:31, ...}, t:<ms>, s:'<24 hex, random per session>'}, ...]}
// Nothing personal is stored: no IP address, no user agent, no device or advertising id. See README.md (deploy, queries, privacy).
const MAX_BODY = 200000, MAX_EV = 100, MAX_PROPS = 1000, DAY = 86400000;
const HEX24 = /^[0-9a-f]{24}$/, NAME = /^[a-z0-9_]{1,32}$/, SHORT = /^[\w.\- ]{0,24}$/;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};
const reply = (status, text) => new Response(text || null, { status, headers: CORS });

// The batch's rows, or null when the batch is malformed. Bad single events are skipped, not fatal.
export function rows(body, now) {
  if (!body || typeof body !== 'object' || body.v !== 1 || !HEX24.test(body.iid) || !Array.isArray(body.ev)) return null;
  const plat = body.plat === 'ios' || body.plat === 'web' ? body.plat : 'other';
  const app = typeof body.app === 'string' && SHORT.test(body.app) ? body.app : '';
  const build = typeof body.build === 'string' && SHORT.test(body.build) ? body.build : '';
  const out = [];
  for (const e of body.ev.slice(0, MAX_EV)) {
    if (!e || typeof e !== 'object' || !NAME.test(e.n)) continue;
    // device clocks drift or get set by hand: keep the device time, but never one from the far past or future
    let t = Math.round(+e.t);
    if (!isFinite(t) || t < now - 30 * DAY || t > now + DAY) t = now;
    let props = '{}';
    if (e.p && typeof e.p === 'object' && !Array.isArray(e.p)) {
      const p = {};
      for (const k of Object.keys(e.p).slice(0, 12)) {
        const v = e.p[k];
        if (typeof v === 'number' && isFinite(v)) p[k.slice(0, 16)] = v;
        else if (typeof v === 'boolean') p[k.slice(0, 16)] = v;
        else if (typeof v === 'string') p[k.slice(0, 16)] = v.slice(0, 40);
      }
      props = JSON.stringify(p);
      if (props.length > MAX_PROPS) props = '{}';
    }
    out.push([body.iid, HEX24.test(e.s) ? e.s : '', e.n, props, t, new Date(t).toISOString().slice(0, 10), plat, app, build, now]);
  }
  return out;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return reply(204);
    if (req.method !== 'POST') return reply(405, 'POST only');
    if ((+req.headers.get('content-length') || 0) > MAX_BODY) return reply(413, 'too large');
    let body;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY) return reply(413, 'too large');
      body = JSON.parse(text);
    } catch (e) {
      return reply(400, 'bad json');
    }
    const list = rows(body, Date.now());
    if (!list) return reply(400, 'bad batch');
    if (list.length) {
      const stmt = env.DB.prepare('INSERT INTO events (iid, sid, name, props, t, day, plat, app, build, recv) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)');
      await env.DB.batch(list.map((r) => stmt.bind(...r)));
    }
    return reply(204);
  }
};
