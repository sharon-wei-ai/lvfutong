import { seedAlerts, topics } from "./data.js";

const KEY = "lvfutong-v1";

const defaults = {
  identity: "",
  region: "云南",
  topics: ["mine", "understory", "eod"],
  saved: [],
  read: [],
  onboarded: false,
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults, alerts: seedAlerts };
    const parsed = JSON.parse(raw);
    const next = {
      ...defaults,
      ...parsed,
      alerts: mergeAlerts(parsed.alerts, seedAlerts),
    };
    if (next.region === "全国") next.region = "云南";
    return next;
  } catch {
    return { ...defaults, alerts: seedAlerts };
  }
}

function mergeAlerts(stored = [], seed) {
  const ids = new Set(stored.map((a) => a.id));
  return [...stored, ...seed.filter((a) => !ids.has(a.id))];
}

export function saveState(state) {
  const { alerts, ...rest } = state;
  localStorage.setItem(KEY, JSON.stringify({ ...rest, alerts }));
}

export function unreadCount(state) {
  return state.alerts.filter((a) => !state.read.includes(a.id)).length;
}

export function matchesUser(item, state) {
  const regionOk =
    state.region === "全国" ||
    item.region === "全国" ||
    item.region?.includes(state.region);
  const topicOk = item.topics?.some((t) => state.topics.includes(t));
  const idOk =
    !state.identity ||
    !item.identities ||
    item.identities.includes(state.identity);
  return regionOk && (topicOk || idOk);
}

export function scoreItem(item, state) {
  let s = 0;
  if (item.identities?.includes(state.identity)) s += 3;
  if (item.topics?.some((t) => state.topics.includes(t))) s += 2;
  if (item.region === state.region) s += 2;
  if (item.region === "全国") s += 1;
  if (item.urgency === "high") s += 2;
  return s;
}

export function topicName(id) {
  return topics.find((t) => t.id === id)?.name || id;
}

export function pushAlert(state, alert) {
  const next = {
    ...state,
    alerts: [alert, ...state.alerts.filter((a) => a.id !== alert.id)],
  };
  saveState(next);
  return next;
}

export function markRead(state, id) {
  if (state.read.includes(id)) return state;
  const next = { ...state, read: [...state.read, id] };
  saveState(next);
  return next;
}

export function markAllRead(state) {
  const next = { ...state, read: state.alerts.map((a) => a.id) };
  saveState(next);
  return next;
}

export function toggleSave(state, kind, id) {
  const key = `${kind}:${id}`;
  const saved = state.saved.includes(key)
    ? state.saved.filter((x) => x !== key)
    : [...state.saved, key];
  const next = { ...state, saved };
  saveState(next);
  return next;
}

export function isSaved(state, kind, id) {
  return state.saved.includes(`${kind}:${id}`);
}

export function toggleTopic(state, id) {
  const topicsNext = state.topics.includes(id)
    ? state.topics.filter((t) => t !== id)
    : [...state.topics, id];
  const next = { ...state, topics: topicsNext };
  saveState(next);
  return next;
}
