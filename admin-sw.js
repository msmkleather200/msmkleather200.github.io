/* M.K. Leather অ্যাডমিন: সার্ভিস ওয়ার্কার (ইনস্টল + পুশ নোটিফিকেশন) */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});

/* সার্ভার থেকে আসা পুশ (শুধু data পাঠালে এটাই নোটিফিকেশন দেখায়) */
self.addEventListener('push', function (e) {
  var d = {};
  try {
    var j = e.data ? e.data.json() : {};
    d = j.data || j.notification || j;
  } catch (_) {}
  var title = d.title || 'নতুন অর্ডার এসেছে!';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'order',
    renotify: true,
    vibrate: [200, 100, 200, 100, 300],
    data: { url: d.url || '/admin.html' }
  }));
});

/* নোটিফিকেশনে চাপলে অ্যাডমিন অ্যাপ খুলবে */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('admin.html') > -1 && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});
