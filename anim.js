/* M/S, M.K. Leather - ভাউচার অ্যানিমেশন (ভার্সন ২)
   1) পণ্যের পাতায় Collect চাপলে ভাউচার ফোঁটা ফোঁটা দাগ বরাবর ছিঁড়ে নিচে পড়ে যায়, আর ওই জায়গা থেকে চিরতরে সরে যায়
   2) অর্ডার পাতায় ভাউচার বাছলে ভাউচার স্ক্রিনের মাঝে এসে নিজে নিজে ছাড়ের ঘরে ঢুকে যায়
   শব্দ কোড দিয়েই বানানো (কোনো অডিও ফাইল নেই), সাথে ফোনের ভাইব্রেশন */
(function () {
  var css = `
.tp{position:fixed;margin:0!important;z-index:50;pointer-events:none;will-change:transform,opacity}
.tp.l{animation:tpl .95s cubic-bezier(.45,0,.85,.55) forwards}
.tp.r{animation:tpr .95s cubic-bezier(.45,0,.85,.55) forwards}
@keyframes tpl{0%{transform:none;opacity:1}22%{transform:translateX(-8px) rotate(-7deg);opacity:1}100%{transform:translate(-26px,300px) rotate(-30deg);opacity:0}}
@keyframes tpr{0%{transform:none;opacity:1}22%{transform:translateX(8px) rotate(6deg);opacity:1}100%{transform:translate(30px,340px) rotate(26deg);opacity:0}}
.fly{position:fixed;margin:0!important;z-index:60;pointer-events:none;box-shadow:0 16px 40px rgba(0,0,0,.45);transform-origin:center center}
.pulse{display:inline-block;animation:pls .6s ease}
@keyframes pls{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.tp,.fly{display:none}}
`;
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function RM() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  }

  /* ===== শব্দ ও ভাইব্রেশন ===== */
  var AC = null;
  function ac() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
    } catch (e) {}
    return AC;
  }
  function vib(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  }
  function tone(f, t0, d, v) {
    var a = AC, n = a.currentTime + t0, o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(v, n + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, n + d);
    o.connect(g);
    g.connect(a.destination);
    o.start(n);
    o.stop(n + d + 0.05);
  }
  function snd(k) {
    var a = ac();
    if (!a) return;
    try {
      if (k === 'tear') {
        var L = Math.floor(a.sampleRate * 0.5), b = a.createBuffer(1, L, a.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < L; i++) {
          var e = Math.pow(1 - i / L, 1.4);
          d[i] = (Math.random() * 2 - 1) * e * (Math.random() < 0.6 ? 1 : 0.2);
        }
        var s = a.createBufferSource();
        s.buffer = b;
        var f = a.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 1500;
        var g = a.createGain();
        g.gain.value = 0.6;
        s.connect(f);
        f.connect(g);
        g.connect(a.destination);
        s.start();
      } else if (k === 'pop') {
        tone(520, 0, 0.12, 0.25);
      } else if (k === 'ding') {
        tone(880, 0, 0.25, 0.25);
        tone(1320, 0.12, 0.35, 0.2);
      }
    } catch (e) {}
  }

  /* ===== ছেঁড়ার পর কার্ড তালিকা থেকে সরিয়ে ফেলা ===== */
  function gone(card) {
    var par = card.parentNode;
    var horiz = !!(par && par.classList && par.classList.contains('vsc'));
    var r = card.getBoundingClientRect();
    function done() {
      var box = card.closest ? card.closest('.vbx') : null;
      card.remove();
      if (box && !box.querySelector('.vk')) box.remove();
    }
    if (RM() || !card.animate || !r.width || !r.height) {
      done();
      return;
    }
    card.style.visibility = 'hidden';
    card.style.overflow = 'hidden';
    var kf = horiz
      ? [{ width: r.width + 'px', marginRight: '0px' }, { width: '0px', marginRight: '-10px' }]
      : [{ height: r.height + 'px', marginBottom: '12px' }, { height: '0px', marginBottom: '0px' }];
    var an = card.animate(kf, { duration: 280, easing: 'ease', fill: 'forwards' });
    an.onfinish = done;
  }

  /* ===== ভাউচার ছেঁড়া ===== */
  function tearV(card) {
    if (RM()) return 0;
    var r = card.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    var ka = card.querySelector('.vka'), s = ka ? ka.offsetWidth : 86, w = r.width, h = r.height, J = [];
    for (var y = 0; y < h; y += 7) J.push([s + (Math.random() * 8 - 4), y]);
    J.push([s + (Math.random() * 8 - 4), h]);
    var zz = J.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',');
    var pl = 'polygon(0px 0px,' + zz + ',0px ' + h + 'px)';
    var pr = 'polygon(' + zz + ',' + w + 'px ' + h + 'px,' + w + 'px 0px)';
    function mk(c, p) {
      var e = card.cloneNode(true);
      e.removeAttribute('onclick');
      e.classList.add('tp', c);
      Object.assign(e.style, {
        left: r.left + 'px', top: r.top + 'px', width: w + 'px', height: h + 'px',
        clipPath: p, webkitClipPath: p, transformOrigin: s + 'px 100%'
      });
      document.body.appendChild(e);
      return e;
    }
    var a = mk('l', pl), b = mk('r', pr);
    card.style.visibility = 'hidden';
    setTimeout(function () {
      a.remove();
      b.remove();
      gone(card);
    }, 950);
    return 1;
  }

  /* জমা বা ব্যবহার হয়ে যাওয়া ভাউচার আর ভাউচার তালিকায় দেখানো হবে না */
  var _vcRow = window.vcRow;
  window.vcRow = function (v) {
    return CVM[v.id] ? '' : _vcRow(v);
  };
  var _vboxH = window.vboxH;
  window.vboxH = function () {
    if (VCH && VCH.length && VCH.every(function (v) { return CVM[v.id]; })) return '<div id="vbox"></div>';
    return _vboxH();
  };

  /* Collect চাপলে */
  window.collectV = async function (id) {
    ac();
    if (!user) {
      optX();
      pend = function () { return window.collectV(id); };
      authM('login', 'ভাউচার নিতে আগে লগইন করুন।');
      return;
    }
    if (CVM[id]) {
      toast(CVM[id].used ? 'ভাউচারটি আগেই ব্যবহার হয়েছে' : 'ভাউচারটি আগেই জমা আছে');
      return;
    }
    try {
      await db.collection('users').doc(user.uid).collection('cv').doc(id).set({ used: false, t: Date.now() });
      CVM[id] = { used: false };
      var torn = 0;
      document.querySelectorAll('.vkc[data-v="' + id + '"]').forEach(function (b) {
        var c = b.closest('.vk');
        if (!c) return;
        if (tearV(c)) torn++;
        else gone(c);
      });
      if (torn) {
        snd('tear');
        vib([40, 30, 80]);
      }
      toast('ভাউচার জমা হয়েছে ✓');
    } catch (e) {
      console.error(e);
      toast('জমা করা যায়নি, আবার চেষ্টা করুন');
    }
  };

  /* ===== অর্ডার পাতায় ভাউচার বাছা ===== */
  window.vpick = function (id) {
    var nv = id && !(selV && selV.id == id) ? VCH.find(function (v) { return v.id == id; }) : null;
    var ev = window.event, el = ev && ev.target && ev.target.closest ? ev.target.closest('.vk') : null;
    var sub = window._sub || 0;
    if (!nv || !el || RM()) {
      selV = nv;
      optX();
      tot(sub);
      return;
    }
    ac();
    var r = el.getBoundingClientRect(), f = el.cloneNode(true);
    f.removeAttribute('onclick');
    f.className = 'vk fly';
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(f);
    optX();
    snd('pop');
    vib(25);
    var bx = r.left + r.width / 2, by = r.top + r.height / 2, sc = Math.min(1.12, (innerWidth - 24) / r.width);
    var mid = 'translate(' + (innerWidth / 2 - bx) + 'px,' + (innerHeight / 2 - by) + 'px) scale(' + sc + ')';
    var a1 = f.animate([{ transform: 'none' }, { transform: mid }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'forwards' });
    a1.onfinish = function () {
      setTimeout(function () {
        var t = document.getElementById('vv2'), tr = t ? t.getBoundingClientRect() : null;
        var tx = tr ? tr.left + tr.width / 2 : innerWidth / 2, ty = tr ? tr.top + tr.height / 2 : innerHeight - 120;
        var end = 'translate(' + (tx - bx) + 'px,' + (ty - by) + 'px) scale(.12)';
        var a2 = f.animate([{ transform: mid, opacity: 1 }, { transform: end, opacity: 0.15 }], { duration: 560, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
        a2.onfinish = function () {
          f.remove();
          selV = nv;
          tot(sub);
          snd('ding');
          vib([20, 40, 20]);
          ['tt', 'vdv'].forEach(function (i) {
            var x = document.getElementById(i);
            if (x) {
              x.classList.remove('pulse');
              void x.offsetWidth;
              x.classList.add('pulse');
              setTimeout(function () { x.classList.remove('pulse'); }, 700);
            }
          });
        };
      }, 550);
    };
  };
})();
