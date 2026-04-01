import { useEffect, useState } from "react";
import { addNote, deleteNote, fetchNotes } from "../api/papers";

const LOCAL_NOTES_PREFIX = "sarveshu-notes-local";

function normalizeValue(value) {
  return String(value || "").trim();
}

function lower(value) {
  return normalizeValue(value).toLowerCase();
}

function sortNotes(notes) {
  return [...notes].sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(
      String(a.updatedAt || a.createdAt || "")
    )
  );
}

function localNotesKey(userName) {
  const normalizedUserName = lower(userName);
  if (!normalizedUserName) return "";
  return `${LOCAL_NOTES_PREFIX}:${normalizedUserName}`;
}

function readLocalNotes(userName) {
  if (typeof window === "undefined") return [];
  const key = localNotesKey(userName);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? sortNotes(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalNotes(userName, notes) {
  if (typeof window === "undefined") return;
  const key = localNotesKey(userName);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(sortNotes(notes)));
}

function normalizePaperUrl(value) {
  const normalized = normalizeValue(value);
  if (!normalized) return "";
  try {
    return new URL(normalized).toString();
  } catch {
    try {
      return new URL(`https://${normalized}`).toString();
    } catch {
      return null;
    }
  }
}

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function NotesPanel() {
  const [userName, setUserName] = useState("");
  const [paperTitle, setPaperTitle] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [remark, setRemark] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadNotes = async (targetUserName) => {
    const normalizedUserName = normalizeValue(targetUserName);
    if (!normalizedUserName) {
      setNotes([]);
      return;
    }

    const localNotes = readLocalNotes(normalizedUserName);
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchNotes(normalizedUserName);
      const remoteNotes = Array.isArray(payload.notes) ? sortNotes(payload.notes) : [];
      const nextNotes = remoteNotes.length > 0 ? remoteNotes : localNotes;
      setNotes(nextNotes);
      writeLocalNotes(normalizedUserName, nextNotes);
    } catch (err) {
      setNotes(localNotes);
      if (localNotes.length > 0) {
        setError("backend unavailable. showing local notes from this device.");
      } else {
        setError(err.message || "failed to load notes");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const normalized = normalizeValue(userName);
    const timeoutId = setTimeout(() => {
      loadNotes(normalized);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [userName]);

  const handleSave = async (event) => {
    event.preventDefault();
    const normalizedUserName = normalizeValue(userName);
    const normalizedPaperTitle = normalizeValue(paperTitle);
    const normalizedPaperUrl = normalizePaperUrl(paperUrl);
    if (!normalizedUserName || !normalizedPaperTitle) {
      setError("name and paper title are required");
      return;
    }
    if (normalizeValue(paperUrl) && !normalizedPaperUrl) {
      setError("paper url must be valid");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await addNote({
        userName: normalizedUserName,
        paperTitle: normalizedPaperTitle,
        paperUrl: normalizedPaperUrl,
        remark: normalizeValue(remark),
      });
      const saved = response?.note || null;
      if (saved) {
        const nextNotes = sortNotes([
          saved,
          ...notes.filter((item) => item.id !== saved.id),
        ]);
        setNotes(nextNotes);
        writeLocalNotes(normalizedUserName, nextNotes);
      } else {
        await loadNotes(normalizedUserName);
      }
      setPaperTitle("");
      setPaperUrl("");
      setRemark("");
    } catch {
      const fallbackNote = {
        id: `local-${Date.now()}`,
        userName: normalizedUserName,
        paperTitle: normalizedPaperTitle,
        paperUrl: normalizedPaperUrl || "",
        remark: normalizeValue(remark),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextNotes = sortNotes([fallbackNote, ...notes]);
      setNotes(nextNotes);
      writeLocalNotes(normalizedUserName, nextNotes);
      setPaperTitle("");
      setPaperUrl("");
      setRemark("");
      setError("backend unavailable. note saved locally on this device.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const normalizedUserName = normalizeValue(userName);
    if (!id || !normalizedUserName) return;

    setError(null);
    try {
      await deleteNote(id, normalizedUserName);
      const nextNotes = notes.filter((note) => note.id !== id);
      setNotes(nextNotes);
      writeLocalNotes(normalizedUserName, nextNotes);
    } catch (err) {
      const nextNotes = notes.filter((note) => note.id !== id);
      setNotes(nextNotes);
      writeLocalNotes(normalizedUserName, nextNotes);
      setError(
        normalizeValue(err.message) || "backend unavailable. note deleted locally on this device."
      );
    }
  };

  return (
    <section className="panel panel--notes">
      <header className="panel__header">
        <h2 className="panel__title">notes</h2>
        <p className="panel__caption">save papers and personal remarks</p>
      </header>

      <form className="notes-form" onSubmit={handleSave}>
        <label className="notes-form__label">
          name
          <input
            className="notes-form__input"
            type="text"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            required
          />
        </label>

        <label className="notes-form__label">
          paper title
          <input
            className="notes-form__input"
            type="text"
            value={paperTitle}
            onChange={(event) => setPaperTitle(event.target.value)}
            required
          />
        </label>

        <label className="notes-form__label">
          paper url (optional)
          <input
            className="notes-form__input"
            type="url"
            value={paperUrl}
            onChange={(event) => setPaperUrl(event.target.value)}
          />
        </label>

        <label className="notes-form__label">
          remark
          <textarea
            className="notes-form__textarea"
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            rows={3}
          />
        </label>

        <button
          className="notes-form__button"
          type="submit"
          disabled={saving || !normalizeValue(userName) || !normalizeValue(paperTitle)}
        >
          {saving ? "saving..." : "save note"}
        </button>
      </form>

      {error ? <p className="panel__error">{error}</p> : null}
      <div className="notes-list">
        {loading ? <p className="panel__muted">loading notes...</p> : null}
        {!loading && notes.length === 0 ? (
          <p className="panel__muted">no notes yet.</p>
        ) : null}

        {notes.map((note) => (
          <article key={note.id} className="note-card">
            <p className="note-card__title">{note.paperTitle}</p>
            <p className="note-card__meta">
              {note.userName || "unknown"} · {formatDate(note.updatedAt || note.createdAt)}
            </p>
            {note.remark ? <p className="note-card__remark">{note.remark}</p> : null}
            <div className="note-card__actions">
              {note.paperUrl ? (
                <a href={note.paperUrl} target="_blank" rel="noopener noreferrer">
                  open
                </a>
              ) : null}
              <button type="button" onClick={() => handleDelete(note.id)}>
                delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
