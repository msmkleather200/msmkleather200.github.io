// Cloudflare Worker: M/S, M.K. Leather AI chat
// Secrets/Variables needed in Cloudflare:
//   GEMINI_KEY  (Secret)  -> your Google AI Studio API key
//   MODEL       (optional) -> model name; default is gemini-flash-latest
//   FIREBASE_SA (Secret)  -> Firebase service account JSON (নতুন অর্ডারের নোটিফিকেশনের জন্য)

const SITE = 'https://msmkleather200.github.io';
const FALLBACK = 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে ০১৮৪৫৯০৭৩২১ নম্বরে কল বা হোয়াটসঅ্যাপ করুন।';

const PROJECT_ID = 'msmklearther';
const FS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

/* ===== নতুন অর্ডারে অ্যাডমিনের ফোনে পুশ নোটিফিকেশন (Firebase ফ্রি/Spark প্ল্যানেই চলে) ===== */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function googleToken(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64u(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claim));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + head + '.' + claim + '.' + b64u(sig),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token ' + JSON.stringify(j).slice(0, 150));
  return j.access_token;
}

const fv = (f) => (f ? (f.stringValue ?? f.integerValue ?? f.doubleValue ?? '') : '');

async function notify(request, env, cors) {
  const res = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
  let orderId = '';
  try { orderId = String((await request.json()).orderId || ''); } catch (e) { return res({ ok: false }, 400); }
  if (!/^[A-Za-z0-9]{10,40}$/.test(orderId)) return res({ ok: false }, 400);
  if (!env.FIREBASE_SA) return res({ ok: false, why: 'no-secret' }, 500);
  try {
    const tk = await googleToken(env);
    const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };

    const or = await fetch(FS + '/orders/' + orderId, { headers: H });
    if (!or.ok) return res({ ok: false, why: 'no-order' }, 404);
    const doc = await or.json();
    const f = doc.fields || {};
    if (f.pushed && f.pushed.booleanValue) return res({ ok: true, why: 'already' });
    const ct = f.createdAt && f.createdAt.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0;
    if (!ct || Date.now() - ct > 10 * 60 * 1000) return res({ ok: false, why: 'old' }, 400);

    /* একবারই পাঠানোর জন্য আগে "pushed" চিহ্ন বসাই (একসাথে দুইবার এলে একটাই সফল হবে) */
    const claim = await fetch(FS + '/orders/' + orderId + '?updateMask.fieldPaths=pushed&currentDocument.updateTime=' + encodeURIComponent(doc.updateTime), {
      method: 'PATCH', headers: H, body: JSON.stringify({ fields: { pushed: { booleanValue: true } } }),
    });
    if (!claim.ok) return res({ ok: true, why: 'race' });

    const tr = await fetch(FS + '/adminTokens?pageSize=50', { headers: H });
    const tj = await tr.json();
    const tokens = (tj.documents || []).map((d) => decodeURIComponent(d.name.split('/').pop()));
    if (!tokens.length) return res({ ok: true, sent: 0 });

    const name = String(fv(f.name) || 'গ্রাহক');
    const total = String(fv(f.total) || '0');
    let sent = 0;
    for (const token of tokens) {
      const m = await fetch('https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send', {
        method: 'POST', headers: H,
        body: JSON.stringify({ message: {
          token,
          data: { title: 'নতুন অর্ডার এসেছে!', body: name + ' · ৳' + total, url: '/admin.html', tag: 'order-' + orderId },
          android: { priority: 'HIGH' },
          webpush: { headers: { Urgency: 'high', TTL: '3600' } },
        } }),
      });
      if (m.ok) { sent++; continue; }
      const e = await m.text();
      if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(e)) {
        await fetch(FS + '/adminTokens/' + encodeURIComponent(token), { method: 'DELETE', headers: H });
      }
    }
    return res({ ok: true, sent });
  } catch (e) {
    return res({ ok: false, why: String(e).slice(0, 150) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': SITE,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8',
    };
    const out = (reply, status = 200) =>
      new Response(JSON.stringify({ reply }), { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (new URL(request.url).pathname === '/notify') {
      if (request.method !== 'POST' || request.headers.get('Origin') !== SITE) return out('', 403);
      return notify(request, env, cors);
    }
    if (request.method !== 'POST' || request.headers.get('Origin') !== SITE) {
      return out('', 403);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return out(FALLBACK);
    }

    const dhaka = Number(body.dhaka) || 80;
    const outside = Number(body.out) || 130;
    const products = String(body.products || '').slice(0, 4000);

    const system = `তুমি "M/S, M.K. Leather" অনলাইন দোকানের সহকারী। গ্রাহকের সাথে বাংলায়, ভদ্রভাবে, ছোট করে (২-৪ বাক্যে) কথা বলো।

দোকান: জেনুইন লেদারের মানিব্যাগ, জুতা, ব্যাগ ও বেল্ট। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।
ডেলিভারি চার্জ: ঢাকায় ৳${dhaka}, ঢাকার বাইরে ৳${outside}।
পেমেন্ট: এখন শুধু ক্যাশ অন ডেলিভারি চালু। বিকাশ, নগদ, রকেট ও পার্সোনাল এখন চালু নেই (সার্ভারে সমস্যা, ঠিক হলে জানানো হবে)।
অর্ডারের নিয়ম: সাইটে পণ্য বেছে "এখনই কিনুন" চাপুন, লগইন করুন, নাম, নম্বর ও ঠিকানা দিয়ে কনফার্ম করুন। অর্ডারের অবস্থা সাইটের "অর্ডার" ট্যাবে দেখা যায়।
কাস্টমার কেয়ার: কল বা হোয়াটসঅ্যাপ ০১৮৪৫৯০৭৩২১।

বর্তমান পণ্যের তালিকা:
${products}

নিয়ম:
- দাম, রং, সাইজ শুধু উপরের তালিকা থেকে বলো।
- রিটার্ন/এক্সচেঞ্জ নীতি, ডেলিভারিতে কত দিন লাগবে, স্টক আছে কি না, বা তালিকায় নেই এমন কিছু জানা না থাকলে অনুমান করবে না। বলবে কাস্টমার কেয়ারে কল বা হোয়াটসঅ্যাপ করতে।
- চ্যাটে অর্ডার নেওয়া যায় না। কেউ অর্ডার করতে, কিনতে বা কীভাবে নেবে জানতে চাইলে (যেমন: অর্ডার করতে চাই, অর্ডার করব কিভাবে, কিনব কিভাবে, কিভাবে নিব, কিভাবে পাব, নিতে চাই, order, buy, order korbo kivabe) সংক্ষেপে বলো যে অর্ডারের নিয়ম ভিডিওতে দেখানো আছে, এবং হুবহু এই লিংকটা দাও: https://youtube.com/shorts/RNc5hKHA6Gg
- ভিডিও লিংক ছাড়া অন্য কোনো লিংক বানাবে না।`;

    const contents = (Array.isArray(body.messages) ? body.messages : [])
      .slice(-12)
      .map((m) => ({
        role: m.from === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text || '').slice(0, 800) }],
      }));
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) return out(FALLBACK);

    try {
      const model = env.MODEL || 'gemini-flash-latest';
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': env.GEMINI_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
          }),
        }
      );
      const data = await r.json();
      const text = (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();
      return out(text || FALLBACK);
    } catch (e) {
      return out(FALLBACK);
    }
  },
};
