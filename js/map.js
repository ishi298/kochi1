// ==============================
// 初期設定
// ==============================

const FALLBACK_LOCATION = { lat: 33.5597, lng: 133.5311 };

const MOOD_SETTINGS = {
  relax: { angleRange: Math.PI / 3, distanceRate: 0.8 },
  city: { angleRange: Math.PI, distanceRate: 1.0 },
  adventure: { angleRange: Math.PI * 2, distanceRate: 1.2 }
};

let map = L.map("map").setView(
  [FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng], 13
);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

let routeLayer;

let walkData = {
  start: null,
  goal: null,
  mood: null,
  distanceKm: null,
  startTime: null
};

// ==============================
// カスタムアイコン
// ==============================

const startIcon = L.divIcon({
  className: "custom-marker start-marker",
  html: "🏁",
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const checkpointIcon = L.divIcon({
  className: "custom-marker checkpoint-marker",
  html: "📍",
  iconSize: [26, 26],
  iconAnchor: [13, 26]
});

const goalIcon = L.divIcon({
  className: "custom-marker goal-marker",
  html: "🎉",
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

// ==============================
// 位置取得
// ==============================

function getCurrentLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(FALLBACK_LOCATION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      () => resolve(FALLBACK_LOCATION),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ==============================
// ランダム地点生成
// ==============================

function createRandomGoal(lat, lng, distanceKm, mood) {
  const setting = MOOD_SETTINGS[mood];
  const baseAngle = Math.random() * 2 * Math.PI;
  const angle = baseAngle + (Math.random() - 0.5) * setting.angleRange;
  const delta = distanceKm * setting.distanceRate * 0.009;

  return {
    lat: lat + Math.cos(angle) * delta,
    lng: lng + Math.sin(angle) * delta
  };
}

// ==============================
// 往路生成（チェックポイント型）
// ==============================

async function generateRoute() {
  if (routeLayer) map.removeLayer(routeLayer);

  const mood = document.getElementById("mood").value;
  const distanceKm = Number(document.getElementById("distance").value);

  const start = await getCurrentLocation();
  walkData = { start, mood, distanceKm, startTime: new Date() };

  const cp1 = createRandomGoal(start.lat, start.lng, distanceKm/3, mood);
  const cp2 = createRandomGoal(cp1.lat, cp1.lng, distanceKm/3, mood);
  const goal = createRandomGoal(cp2.lat, cp2.lng, distanceKm/3, mood);

  walkData.goal = goal;

  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${start.lng},${start.lat};` +
    `${cp1.lng},${cp1.lat};` +
    `${cp2.lng},${cp2.lat};` +
    `${goal.lng},${goal.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.routes?.length) {
    alert("ルート生成失敗");
    return;
  }

  routeLayer = L.layerGroup().addTo(map);

  // 赤ルート
  L.geoJSON(data.routes[0].geometry, {
    style: { weight: 6, color: "#ff6b6b" }
  }).addTo(routeLayer);

  L.marker([start.lat, start.lng], { icon: startIcon })
    .addTo(routeLayer)
    .bindPopup("<b>スタート</b><br>ここから散歩開始！");

  L.marker([cp1.lat, cp1.lng], { icon: checkpointIcon })
    .addTo(routeLayer)
    .bindPopup("チェックポイント①");

  L.marker([cp2.lat, cp2.lng], { icon: checkpointIcon })
    .addTo(routeLayer)
    .bindPopup("チェックポイント②");

  L.marker([goal.lat, goal.lng], { icon: goalIcon })
    .addTo(routeLayer)
    .bindPopup("<b>ゴール！</b><br>おつかれさま！");

  map.fitBounds(routeLayer.getBounds());
}

// ==============================
// 帰路生成（別ルート）
// ==============================

async function generateReturnRoute() {
  if (!walkData.goal || !walkData.start) {
    alert("先に散歩を開始してください");
    return;
  }

  if (routeLayer) map.removeLayer(routeLayer);

  const cp1 = createRandomGoal(
    walkData.goal.lat, walkData.goal.lng,
    walkData.distanceKm/3, walkData.mood
  );

  const cp2 = createRandomGoal(
    cp1.lat, cp1.lng,
    walkData.distanceKm/3, walkData.mood
  );

  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${walkData.goal.lng},${walkData.goal.lat};` +
    `${cp1.lng},${cp1.lat};` +
    `${cp2.lng},${cp2.lat};` +
    `${walkData.start.lng},${walkData.start.lat}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.routes?.length) {
    alert("帰路生成失敗");
    return;
  }

  routeLayer = L.layerGroup().addTo(map);

  // 青ルート
  L.geoJSON(d
