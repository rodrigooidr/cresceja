// backend/scripts/smoke.js
const base = process.env.BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.SMOKE_EMAIL || 'rodrigooidr@hotmail.com';
const adminPass = process.env.SMOKE_PASS || 'R0drig01!';

async function hit(path, opts={}){
  const r = await fetch(base + path, Object.assign({ headers: { 'Content-Type':'application/json' }}, opts));
  return { status: r.status, json: await r.json().catch(()=> ({})) };
}

(async () => {
  let ok = true;
  const h = await hit('/api/healthz');
  console.log('healthz:', h.status, h.json);
  ok &&= h.status === 200 && h.json.ok;

  const r = await hit('/api/readyz');
  console.log('readyz:', r.status, r.json);
  ok &&= r.status === 200 && r.json.ok;

  const l = await hit('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: adminEmail, password: adminPass })});
  console.log('login:', l.status, l.json && { user: l.json.user, token: l.json.token ? '***' : null });
  ok &&= l.status === 200 && !!l.json?.token;

  if (!ok) process.exit(2);
  console.log('SMOKE OK ✅');
})().catch((e)=>{ console.error(e); process.exit(1); });
