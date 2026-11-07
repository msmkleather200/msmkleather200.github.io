// Cloudflare Worker: M/S, M.K. Leather AI chat
// Secrets/Variables needed in Cloudflare:
//   GEMINI_KEY  (Secret)  -> your Google AI Studio API key
//   MODEL       (optional) -> model name; default is gemini-flash-latest

const SITE = 'https://msmkleather200.github.io';
const FALLBACK = 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে ০১৮৪৫৯০৭৩২১ নম্বরে কল বা হোয়াটসঅ্যাপ করুন।';

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
- চ্যাটে অর্ডার নেওয়া যায় না, সাইটে অর্ডার করতে বলো।`;

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
