// 設定快取版本名稱，更新內容時可修改版本來刷新舊快取。
const CACHE_NAME = "care-visit-app-v4";
// 定義首次安裝時要預先快取的核心檔案。
const APP_SHELL = ["./", "./index.html", "./install.html", "./manifest.webmanifest", "./favicon.svg"];

// 安裝 service worker 時先把核心檔案存進快取。
self.addEventListener("install", (event) => {
  // 等待快取完成後再結束安裝流程。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// 啟用新版本時清掉舊快取，避免內容混用。
self.addEventListener("activate", (event) => {
  // 等待舊快取清理完成後接手頁面。
  event.waitUntil(
    caches.keys().then((keys) => {
      // 刪除目前版本以外的快取。
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// 攔截請求，讓已載入過的內容在離線時也能打開。
self.addEventListener("fetch", (event) => {
  // 只處理 GET 請求，避免影響其他方法。
  if (event.request.method !== "GET") {
    // 提前結束。
    return;
  }
  // 取得請求網址。
  const requestUrl = new URL(event.request.url);
  // 只快取同網域資源。
  if (requestUrl.origin !== self.location.origin) {
    // 提前結束。
    return;
  }
  // 若是頁面導覽請求，就優先走網路，失敗時回傳快取首頁。
  if (event.request.mode === "navigate") {
    // 使用 network-first 策略處理頁面。
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 複製回應以便存入快取。
          const responseClone = response.clone();
          // 把最新首頁內容存回快取。
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", responseClone));
          // 回傳最新回應。
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    // 提前結束。
    return;
  }
  // 其他靜態資源使用 cache-first，沒有才抓網路。
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 若快取已有資料就直接回傳。
      if (cachedResponse) {
        // 回傳快取內容。
        return cachedResponse;
      }
      // 若沒有快取，就向網路請求。
      return fetch(event.request).then((response) => {
        // 若回應不是成功狀態就直接回傳。
        if (!response.ok) {
          // 回傳原始回應。
          return response;
        }
        // 複製回應以便存入快取。
        const responseClone = response.clone();
        // 把成功回應存進快取。
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        // 回傳最新回應。
        return response;
      });
    })
  );
});
