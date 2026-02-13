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

const startIcon = L.divIcon({
  className: "custom-marker",
  html: "🏁",
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const checkpointIcon = L.divIcon({
  className: "custom-marker",
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
  if (!data.routes?.length) return alert("ルート生成失敗");

  routeLayer = L.layerGroup().addTo(map);

  L.geoJSON(data.routes[0].geometry, {
    style: { weight: 6, color: "#ff6b6b" }
  }).addTo(routeLayer);

  L.marker([start.lat, start.lng], { icon: startIcon }).addTo(routeLayer);
  L.marker([cp1.lat, cp1.lng], { icon: checkpointIcon }).addTo(routeLayer);
  L.marker([cp2.lat, cp2.lng], { icon: checkpointIcon }).addTo(routeLayer);
  L.marker([goal.lat, goal.lng], { icon: goalIcon }).addTo(routeLayer);

  map.fitBounds(routeLayer.getBounds());
}

async function generateReturnRoute() {
  if (!walkData.goal) return alert("先に散歩開始してください");

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
  if (!data.routes?.length) return alert("帰路生成失敗");

  routeLayer = L.layerGroup().addTo(map);

  L.geoJSON(data.routes[0].geometry, {
    style: { weight: 6, color: "#4dabf7" }
  }).addTo(routeLayer);

  L.marker([walkData.goal.lat, walkData.goal.lng], { icon: goalIcon }).addTo(routeLayer);
  L.marker([walkData.start.lat, walkData.start.lng], { icon: startIcon }).addTo(routeLayer);

  map.fitBounds(routeLayer.getBounds());
}

function finishWalk() {
  if (!walkData.startTime) return alert("まだ開始していません");

  const duration = Math.round((new Date() - walkData.startTime)/60000);

  const logEntry = {
    date: new Date().toLocaleDateString(),
    mood: walkData.mood,
    distance: walkData.distanceKm,
    duration
  };

  const logs = JSON.parse(localStorage.getItem("walkLogs") || "[]");
  logs.push(logEntry);
  localStorage.setItem("walkLogs", JSON.stringify(logs));

  displayLogs();
  alert("散歩を記録しました！");
}

function displayLogs() {
  const logs = JSON.parse(localStorage.getItem("walkLogs") || "[]");
  const area = document.getElementById("logArea");

  area.innerHTML = "<b>散歩履歴（直近5件）</b><br>";

  logs.slice(-5).reverse().forEach(log => {
    area.innerHTML +=
      `${log.date}｜${log.mood}｜${log.distance}km｜${log.duration}分<br>`;
  });
}

displayLogs();
