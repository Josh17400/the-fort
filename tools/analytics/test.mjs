// node tools/analytics/test.mjs : the Worker against a fake D1, no Cloudflare account needed.
import worker, { rows } from './worker.js';

let pass = 0;
const fails = [];
const check = (name, ok) => { if (ok) pass++; else fails.push(name); };

const inserted = [];
const env = {
  DB: {
    prepare: (sql) => ({ sql, bind: (...a) => ({ sql, a }) }),
    batch: async (stmts) => { inserted.push(...stmts); return stmts.map(() => ({ success: true })); }
  }
};
const post = (body, headers) => worker.fetch(new Request('https://x.workers.dev/e', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: Object.assign({ 'Content-Type': 'text/plain' }, headers || {})
}), env);
const now = Date.now();
const iid = 'a1b2c3d4e5f60718293a4b5c', sid = '0123456789abcdef01234567';
const good = { v: 1, iid, plat: 'ios', app: '1.0', build: '42', ev: [
  { n: 'session_start', p: { boot: true, away_m: 90 }, t: now - 1000, s: sid },
  { n: 'run_end', p: { map: 'desert', wave: 31, cause: 'tank', long: 'x'.repeat(80), deep: { a: 1 } }, t: now, s: sid },
  { n: 'Bad Name!', p: {}, t: now, s: sid },
  { n: 'old', p: {}, t: now - 90 * 86400000, s: 'nope' }
] };

let r = await post(good);
check('204 on a good batch', r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === '*');
check('3 rows (bad name skipped)', inserted.length === 3);
const row = inserted[1].a;
check('row shape', row[0] === iid && row[1] === sid && row[2] === 'run_end' && row[6] === 'ios' && row[7] === '1.0' && row[8] === '42');
const p = JSON.parse(row[3]);
check('props cleaned', p.map === 'desert' && p.wave === 31 && p.long.length === 40 && !('deep' in p));
check('far-past time clamped, bad sid dropped', inserted[2].a[4] >= now - 5000 && inserted[2].a[1] === '');
check('no ip or user agent column', !/ip|agent/i.test(inserted[0].sql));
check('400 on bad json', (await post('{nope')).status === 400);
check('400 on a bad install id', (await post(Object.assign({}, good, { iid: 'me@example.com' }))).status === 400);
check('400 on a wrong version', (await post(Object.assign({}, good, { v: 2 }))).status === 400);
check('413 on a huge body', (await post('x'.repeat(200001))).status === 413);
check('405 on GET', (await worker.fetch(new Request('https://x.workers.dev/e'), env)).status === 405);
check('204 on preflight', (await worker.fetch(new Request('https://x.workers.dev/e', { method: 'OPTIONS' }), env)).status === 204);
check('rows() caps 100 events', rows({ v: 1, iid, ev: Array.from({ length: 150 }, () => ({ n: 'x', t: now })) }, now).length === 100);

console.log('analytics worker: ' + pass + ' passed, ' + fails.length + ' failed');
fails.forEach((f) => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
