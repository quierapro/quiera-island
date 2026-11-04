// Météo: an example Quiera plugin. It shows the weather in its tab, can keep
// the temperature on the closed island, and peeks when rain is coming.
// See docs/plugins.md for the whole API.

const fr = quiera.language === "fr";
const t = fr
  ? { now: "Maintenant", city: "Ville", back: "Retour", pill: "Dans l'île fermée", rain: (h) => `Pluie probable vers ${h}`, error: "Pas de météo pour l'instant", retry: "Réessayer" }
  : { now: "Now", city: "City", back: "Back", pill: "On the closed island", rain: (h) => `Rain likely around ${h}`, error: "No weather for now", retry: "Try again" };

const CITIES = [
  { name: "Paris", lat: 48.85, lon: 2.35 },
  { name: "Lyon", lat: 45.76, lon: 4.84 },
  { name: "Marseille", lat: 43.3, lon: 5.37 },
  { name: "Bruxelles", lat: 50.85, lon: 4.35 },
  { name: "Montréal", lat: 45.5, lon: -73.57 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
];

// WMO weather codes, as Open-Meteo gives them.
function sky(code, day) {
  if (code === 0) return day ? ["☀️", fr ? "Ensoleillé" : "Sunny"] : ["🌙", fr ? "Dégagé" : "Clear"];
  if (code <= 2) return day ? ["🌤️", fr ? "Éclaircies" : "Partly cloudy"] : ["☁️", fr ? "Peu nuageux" : "Partly cloudy"];
  if (code === 3) return ["☁️", fr ? "Couvert" : "Overcast"];
  if (code <= 48) return ["🌫️", fr ? "Brouillard" : "Fog"];
  if (code <= 57) return ["🌦️", fr ? "Bruine" : "Drizzle"];
  if (code <= 67) return ["🌧️", fr ? "Pluie" : "Rain"];
  if (code <= 77) return ["🌨️", fr ? "Neige" : "Snow"];
  if (code <= 82) return ["🌧️", fr ? "Averses" : "Showers"];
  if (code <= 86) return ["🌨️", fr ? "Averses de neige" : "Snow showers"];
  return ["⛈️", fr ? "Orage" : "Thunderstorm"];
}

let city = quiera.storage.get("city") ?? "Paris";
let inPill = quiera.storage.get("inPill") ?? false;
let picking = false;
let weather = null;
let failed = false;
let lastRainPeek = 0;

async function refresh() {
  const place = CITIES.find((c) => c.name === city) ?? CITIES[0];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    "&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto";
  try {
    const response = await quiera.fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    weather = await response.json();
    failed = false;
    warnOfRain();
  } catch (error) {
    console.warn("weather unavailable:", error.message);
    failed = true;
  }
  show();
}

/** The next hours: from the current hour on. */
function nextHours(count) {
  const now = weather.current.time.slice(0, 13);
  const start = Math.max(0, weather.hourly.time.findIndex((h) => h.slice(0, 13) >= now));
  return weather.hourly.time.slice(start + 1, start + 1 + count).map((time, i) => ({
    hour: time.slice(11, 16),
    temp: Math.round(weather.hourly.temperature_2m[start + 1 + i]),
    code: weather.hourly.weather_code[start + 1 + i],
    rain: weather.hourly.precipitation_probability[start + 1 + i] ?? 0,
  }));
}

function warnOfRain() {
  const soon = nextHours(2).find((h) => h.rain >= 60);
  // Once an hour at most: a peek is a moment, not a nag.
  if (soon && Date.now() - lastRainPeek > 3_600_000) {
    lastRainPeek = Date.now();
    quiera.peek({ icon: "🌧️", title: t.rain(soon.hour), text: `${city} · ${soon.rain} %` });
  }
}

function show() {
  if (picking) {
    quiera.render({
      type: "column",
      gap: 6,
      children: [
        { type: "row", justify: "between", children: [
          { type: "text", text: t.city, style: "title" },
          { type: "button", label: t.back, style: "plain", color: "blue", action: "back" },
        ] },
        { type: "list", items: CITIES.map((c) => ({ title: c.name, icon: c.name === city ? "📍" : "", action: `city:${c.name}` })) },
      ],
    });
    return;
  }
  if (!weather) {
    quiera.render({
      type: "column",
      align: "center",
      justify: "center",
      grow: true,
      gap: 10,
      children: failed
        ? [{ type: "text", text: t.error, style: "body", color: "secondary" }, { type: "button", label: t.retry, action: "refresh" }]
        : [{ type: "progress", ring: true, value: 0.25, size: 24 }],
    });
    return;
  }
  const now = weather.current;
  const [icon, label] = sky(now.weather_code, now.is_day === 1);
  const high = Math.round(weather.daily.temperature_2m_max[0]);
  const low = Math.round(weather.daily.temperature_2m_min[0]);
  quiera.render({
    type: "column",
    gap: 10,
    children: [
      { type: "row", justify: "between", children: [
        { type: "row", gap: 12, children: [
          { type: "icon", icon, size: 40 },
          { type: "column", gap: 0, children: [
            { type: "text", text: `${Math.round(now.temperature_2m)}°`, style: "large" },
            { type: "text", text: `${label} · ${high}° / ${low}°`, style: "caption" },
          ] },
        ] },
        { type: "column", align: "end", gap: 6, children: [
          { type: "button", label: `📍 ${city}`, style: "pill", action: "pick" },
          { type: "toggle", label: t.pill, value: inPill, action: "pill" },
        ] },
      ] },
      { type: "row", justify: "between", children: nextHours(5).map((h) => ({
        type: "column", align: "center", gap: 2, children: [
          { type: "text", text: h.hour, style: "caption", color: "tertiary" },
          { type: "icon", icon: sky(h.code, true)[0], size: 18 },
          { type: "text", text: `${h.temp}°`, style: "caption", color: h.rain >= 60 ? "blue" : "primary" },
        ],
      })) },
    ],
  });
  if (inPill) quiera.activity.set({ icon, text: `${Math.round(now.temperature_2m)}°` });
  else quiera.activity.clear();
}

quiera.on("refresh", refresh);
quiera.on("pick", () => {
  picking = true;
  show();
});
quiera.on("back", () => {
  picking = false;
  show();
});
quiera.on("pill", (on) => {
  inPill = on;
  quiera.storage.set("inPill", on);
  show();
});
for (const c of CITIES) {
  quiera.on(`city:${c.name}`, () => {
    city = c.name;
    quiera.storage.set("city", city);
    picking = false;
    weather = null;
    show();
    refresh();
  });
}
// Fresh when the tab opens, and every 15 minutes in the background.
quiera.onOpen(refresh);
setInterval(refresh, 15 * 60_000);

show();
refresh();
