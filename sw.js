const sendToPage = (data, callback) => {
    self.clients.matchAll().then(function (clients) {
        if (clients && clients.length) {
            let tab = null;

            clients.forEach(client => {
                if (client.url.indexOf('holychords.pro') > -1 && client.focused) {
                    tab = client;
                }
            });

            if (tab !== null) {
                tab.postMessage(data);

                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    });
}

self.addEventListener("install", function (event) {
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }

    const payload = event.data ? event.data.json() : {};
    
    sendToPage(payload, (focused) => {
        if (!focused) {
            event.waitUntil(self.registration.showNotification(payload.title, payload));
        }
    })
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.notification?.data?.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});