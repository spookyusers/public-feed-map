const MAP_START_ZOOM = 13;
const RADIUS_MILES = 5;
const MILES_TO_METERS = 1609.34;
const FEEDS_PATH = "../data/feeds.json";

const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

function milesBetween(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(startLat) * Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function buildPopup(feed) {
  const wrapper = document.createElement("div");
  wrapper.className = "popup";

  const title = document.createElement("h3");
  title.textContent = feed.name;

  const meta = document.createElement("p");
  meta.className = "popup-meta";
  meta.textContent = `${feed.type} feed`;

  wrapper.appendChild(title);
  wrapper.appendChild(meta);

  if (feed.embed_url) {
    const frame = document.createElement("iframe");
    frame.src = feed.embed_url;
    frame.loading = "lazy";
    frame.title = `${feed.name} live feed`;
    frame.allow = "autoplay; fullscreen";
    wrapper.appendChild(frame);
  } else {
    const link = document.createElement("a");
    link.href = feed.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open feed in new tab";
    wrapper.appendChild(link);
  }

  return wrapper;
}

function initializeMap(userLat, userLon) {
  const map = L.map("map").setView([userLat, userLon], MAP_START_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  L.circle([userLat, userLon], {
    radius: RADIUS_MILES * MILES_TO_METERS,
    color: "#2c6fbb",
    fillColor: "#2c6fbb",
    fillOpacity: 0.12,
  }).addTo(map);

  L.marker([userLat, userLon], { title: "You are here" })
    .addTo(map)
    .bindPopup("Your location");

  return map;
}

async function loadFeeds() {
  const response = await fetch(FEEDS_PATH);
  if (!response.ok) {
    throw new Error("Unable to load feeds.json");
  }
  return response.json();
}

async function startApp() {
  setStatus("Requesting location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;
      const map = initializeMap(userLat, userLon);

      try {
        const feeds = await loadFeeds();
        const nearbyFeeds = feeds.filter((feed) => {
          const distance = milesBetween(
            userLat,
            userLon,
            feed.latitude,
            feed.longitude
          );
          return distance <= RADIUS_MILES;
        });

        if (nearbyFeeds.length === 0) {
          setStatus("No feeds found within 5 miles.");
          return;
        }

        nearbyFeeds.forEach((feed) => {
          const marker = L.marker([feed.latitude, feed.longitude], {
            title: feed.name,
          }).addTo(map);
          marker.bindPopup(buildPopup(feed));
        });

        setStatus(`Loaded ${nearbyFeeds.length} feed(s) within 5 miles.`);
      } catch (error) {
        console.error(error);
        setStatus("Could not load feed data.");
      }
    },
    (error) => {
      console.error(error);
      setStatus("Location access denied. Unable to show nearby feeds.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

if ("geolocation" in navigator) {
  startApp();
} else {
  setStatus("Geolocation is not supported in this browser.");
}
