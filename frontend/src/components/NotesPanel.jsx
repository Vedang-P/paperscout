import { useEffect, useState } from "react";
import { addNote, deleteNote, fetchNotes } from "../api/papers";

const USER_STORAGE_KEY = "sarveshu-notes-user";

function normalizeValue(value) {
  return String(value || "").trim();
}

export default function NotesPanel() {
  const [userName, setUserName] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(USER_STORAGE_KEY) || ""
  );
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

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchNotes(normalizedUserName);
      setNotes(Array.isArray(payload.notes) ? payload.notes : []);
    } catch (err) {
      setError(err.message || "failed to load notes");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const normalized = normalizeValue(userName);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_STORAGE_KEY, normalized);
    }
    loadNotes(normalized);
  }, [userName]);

  const handleSave = async (event) => {
    event.preventDefault();
    const normalizedUserName = normalizeValue(userName);
    const normalizedPaperTitle = normalizeValue(paperTitle);
    if (!normalizedUserName || !normalizedPaperTitle) {
      setError("name and paper title are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addNote({
        userName: normalizedUserName,
        paperTitle: normalizedPaperTitle,
        paperUrl: normalizeValue(paperUrl),
        remark: normalizeValue(remark),
      });
      setPaperTitle("");
      setPaperUrl("");
      setRemark("");
      await loadNotes(normalizedUserName);
    } catch (err) {
      setError(err.message || "failed to save note");
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
      await loadNotes(normalizedUserName);
    } catch (err) {
      setError(err.message || "failed to delete note");
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
            placeholder="your name"
          />
        </label>

        <label className="notes-form__label">
          paper title
          <input
            className="notes-form__input"
            type="text"
            value={paperTitle}
            onChange={(event) => setPaperTitle(event.target.value)}
            placeholder="paper title"
          />
        </label>

        <label className="notes-form__label">
          paper url (optional)
          <input
            className="notes-form__input"
            type="url"
            value={paperUrl}
            onChange={(event) => setPaperUrl(event.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="notes-form__label">
          remark
          <textarea
            className="notes-form__textarea"
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="why is this paper interesting?"
            rows={3}
          />
        </label>

        <button className="notes-form__button" type="submit" disabled={saving}>
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
