/* M/S, M.K. Leather: AI chat reply (index.html এর চ্যাটে বসে) */
(function () {
  var WORKER_URL = 'PASTE_YOUR_WORKER_URL_HERE';
  var busy = false;
  var CN = { wallet: 'মানিব্যাগ', shoe: 'জুতা', bag: 'ব্যাগ', belt: 'বেল্ট' };

  function productText() {
    try {
      return P.map(function (x) {
        return '- ' + x.n + ' (' + (CN[x.c] || x.c) + '): দাম ৳' + x.p +
          (x.o ? ' (আগের দাম ৳' + x.o + ')' : '') +
          ', রং: ' + (x.col || []).join('/') +
          (x.sz && x.sz.length ? ', সাইজ: ' + x.sz.join('/') : '') +
          (x.desc ? ', বিবরণ: ' + String(x.desc).slice(0, 120).replace(/\s+/g, ' ') : '');
      }).join('\n');
    } catch (e) { return ''; }
  }

  function bubble(text) {
    var d = document.createElement('div');
    d.className = 'ba';
    d.id = 'ait';
    d.textContent = text;
    var cl = $('#cl');
    if (cl) cl.insertAdjacentElement('afterend', d);
    var mb = $('#mb');
    if (mb) mb.scrollTop = mb.scrollHeight;
    return d;
  }

  window.sendChat = async function (t) {
    t = t || ($('#cm') && $('#cm').value.trim());
    if (!t || !user || busy) return;
    if ($('#cm')) $('#cm').value = '';
    var ce = $('#ce');
    if (ce) ce.textContent = '';
    busy = true;

    var c = db.collection('chats').doc(user.uid);
    var ts = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await c.set({
        uid: user.uid,
        name: (prof && prof.name) || user.displayName || '',
        email: user.email,
        lastMsg: t,
        lastAt: ts,
        unreadAdmin: true
      }, { merge: true });
      await c.collection('messages').add({ text: t, from: 'user', createdAt: ts });
    } catch (e) {
      var x = $('#ce');
      if (x) x.textContent = 'বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।';
      busy = false;
      return;
    }

    var typing = bubble('লিখছি...');
    var reply = '';
    try {
      var hist = [];
      try {
        var s = await c.collection('messages').orderBy('createdAt', 'desc').limit(10).get();
        s.docs.reverse().forEach(function (d) {
          var m = d.data();
          hist.push({ from: m.from, text: m.text });
        });
      } catch (e) { hist = [{ from: 'user', text: t }]; }
      if (!hist.length || hist[hist.length - 1].from !== 'user') hist.push({ from: 'user', text: t });

      var ctl = new AbortController();
      var tm = setTimeout(function () { ctl.abort(); }, 25000);
      var r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: hist,
          products: productText(),
          dhaka: ST.dhaka,
          out: ST.out
        }),
        signal: ctl.signal
      });
      clearTimeout(tm);
      var j = await r.json();
      reply = (j && j.reply) || '';
    } catch (e) { reply = ''; }

    if (!reply) reply = 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে ০১৮৪৫৯০৭৩২১ নম্বরে কল বা হোয়াটসঅ্যাপ করুন।';

    try {
      await c.collection('messages').add({
        text: reply,
        from: 'admin',
        ai: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (typing) typing.remove();
    } catch (e) {
      // Firebase নিয়মে সেভ না হলে অন্তত স্ক্রিনে দেখাবে
      if (typing) typing.textContent = reply;
    }
    busy = false;
    var mb = $('#mb');
    if (mb) mb.scrollTop = mb.scrollHeight;
  };
})();
