const {
  createNote,
  listNotes,
  removeNote,
} = require("../backend/src/services/notesStore");

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const userName = String(req.query?.userName || "");
      const payload = await listNotes(userName);
      return res.status(200).json(payload);
    } catch {
      return res.status(500).json({ error: "Failed to load notes" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = parseBody(req);
      const note = await createNote(body);
      return res.status(201).json({ note });
    } catch (error) {
      return res.status(400).json({
        error: String(error.message || "Failed to save note"),
      });
    }
  }

  if (req.method === "DELETE") {
    try {
      const body = parseBody(req);
      const removed = await removeNote(body);
      return res.status(200).json({ removed });
    } catch {
      return res.status(400).json({ error: "Failed to delete note" });
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Method Not Allowed" });
};
