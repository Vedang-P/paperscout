const crypto = require("crypto");
const { lower, normalizeWhitespace } = require("../utils/text");

const memoryStore = global.__SARVESHU_NOTES_STORE__ || new Map();
if (!global.__SARVESHU_NOTES_STORE__) {
  global.__SARVESHU_NOTES_STORE__ = memoryStore;
}

function normalizeUserName(userName) {
  return normalizeWhitespace(userName || "").slice(0, 80);
}

function userKey(userName) {
  const normalized = lower(normalizeUserName(userName));
  if (!normalized) return "";
  return `notes:user:${normalized}`;
}

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.result || null;
}

async function kvSet(key, value) {
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(
    key
  )}/${encodeURIComponent(value)}`;
  await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
  });
}

async function readNotes(userName) {
  const key = userKey(userName);
  if (!key) return [];

  if (hasKvConfig()) {
    const raw = await kvGet(key);
    const parsed = parseJson(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  const local = memoryStore.get(key);
  return Array.isArray(local) ? local : [];
}

async function writeNotes(userName, notes) {
  const key = userKey(userName);
  if (!key) return;

  if (hasKvConfig()) {
    await kvSet(key, JSON.stringify(notes));
    return;
  }

  memoryStore.set(key, notes);
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function listNotes(userName) {
  const normalizedUserName = normalizeUserName(userName);
  const notes = await readNotes(normalizedUserName);
  return {
    userName: normalizedUserName,
    total: notes.length,
    notes: sortNotes(notes),
  };
}

async function createNote(payload = {}) {
  const userName = normalizeUserName(payload.userName);
  if (!userName) {
    throw new Error("userName is required");
  }

  const paperTitle = normalizeWhitespace(payload.paperTitle || "");
  if (!paperTitle) {
    throw new Error("paperTitle is required");
  }

  const remark = normalizeWhitespace(payload.remark || "");
  const note = {
    id: crypto.randomUUID(),
    userName,
    paperTitle,
    paperId: normalizeWhitespace(payload.paperId || ""),
    paperUrl: normalizeWhitespace(payload.paperUrl || ""),
    remark,
    createdAt: nowIso(),
  };

  const notes = await readNotes(userName);
  notes.push(note);
  await writeNotes(userName, notes);

  return note;
}

async function removeNote({ userName, id }) {
  const normalizedUserName = normalizeUserName(userName);
  const normalizedId = normalizeWhitespace(id || "");
  if (!normalizedUserName || !normalizedId) return false;

  const notes = await readNotes(normalizedUserName);
  const next = notes.filter((note) => note.id !== normalizedId);
  await writeNotes(normalizedUserName, next);
  return next.length !== notes.length;
}

module.exports = { listNotes, createNote, removeNote };
