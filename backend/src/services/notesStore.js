const crypto = require("crypto");
const { lower, normalizeWhitespace } = require("../utils/text");

const memoryStore = global.__SARVESHU_NOTES_STORE__ || new Map();
if (!global.__SARVESHU_NOTES_STORE__) {
  global.__SARVESHU_NOTES_STORE__ = memoryStore;
}

const MAX_USER_NAME_LENGTH = 80;
const MAX_PAPER_TITLE_LENGTH = 300;
const MAX_REMARK_LENGTH = 4000;
const MAX_PAPER_URL_LENGTH = 1200;
const MAX_PAPER_ID_LENGTH = 200;
const MAX_NOTES_PER_USER = 500;

function normalizeUserName(userName) {
  return normalizeWhitespace(userName || "").slice(0, MAX_USER_NAME_LENGTH);
}

function normalizeLimitedText(value, maxLength) {
  return normalizeWhitespace(value || "").slice(0, maxLength);
}

function normalizeUrl(value) {
  const normalized = normalizeLimitedText(value, MAX_PAPER_URL_LENGTH);
  if (!normalized) return "";

  try {
    return new URL(normalized).toString();
  } catch {
    try {
      return new URL(`https://${normalized}`).toString();
    } catch {
      return "";
    }
  }
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

async function kvCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    throw new Error(`kv_command_failed:${response.status}`);
  }
  return response.json();
}

async function kvGet(key) {
  try {
    const payload = await kvCommand(["GET", key]);
    return { ok: true, value: payload?.result ?? null };
  } catch {
    return { ok: false, value: null };
  }
}

async function kvSet(key, value) {
  try {
    await kvCommand(["SET", key, value]);
    return true;
  } catch {
    return false;
  }
}

async function readNotes(userName) {
  const key = userKey(userName);
  if (!key) return [];

  if (hasKvConfig()) {
    const kv = await kvGet(key);
    if (kv.ok) {
      const parsed = parseJson(kv.value, []);
      return Array.isArray(parsed) ? parsed : [];
    }
  }

  const local = memoryStore.get(key);
  return Array.isArray(local) ? local : [];
}

async function writeNotes(userName, notes) {
  const key = userKey(userName);
  if (!key) return;

  if (hasKvConfig()) {
    const stored = await kvSet(key, JSON.stringify(notes));
    if (stored) return;
  }

  memoryStore.set(key, notes);
}

function sortNotes(notes) {
  return [...notes].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(
      String(a.updatedAt || a.createdAt || "")
    )
  );
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

  const paperTitle = normalizeLimitedText(payload.paperTitle || "", MAX_PAPER_TITLE_LENGTH);
  if (!paperTitle) {
    throw new Error("paperTitle is required");
  }

  const notes = await readNotes(userName);
  const remark = normalizeLimitedText(payload.remark || "", MAX_REMARK_LENGTH);
  const paperId = normalizeLimitedText(payload.paperId || "", MAX_PAPER_ID_LENGTH);
  const paperUrl = normalizeUrl(payload.paperUrl || "");
  const now = nowIso();
  const titleKey = lower(paperTitle);

  const existingIndex = notes.findIndex((note) => lower(note.paperTitle || "") === titleKey);
  if (existingIndex >= 0) {
    const existing = notes[existingIndex];
    const next = {
      ...existing,
      paperTitle,
      paperId: paperId || existing.paperId || "",
      paperUrl: paperUrl || existing.paperUrl || "",
      remark: remark || existing.remark || "",
      updatedAt: now,
    };
    notes[existingIndex] = next;
    await writeNotes(userName, notes);
    return next;
  }

  const note = {
    id: crypto.randomUUID(),
    userName,
    paperTitle,
    paperId,
    paperUrl,
    remark,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  if (notes.length > MAX_NOTES_PER_USER) {
    notes.sort((a, b) =>
      String(b.updatedAt || b.createdAt || "").localeCompare(
        String(a.updatedAt || a.createdAt || "")
      )
    );
    notes.length = MAX_NOTES_PER_USER;
  }
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
