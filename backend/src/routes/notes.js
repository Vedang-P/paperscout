const express = require("express");
const { createNote, listNotes, removeNote } = require("../services/notesStore");
const { normalizeQueryParam } = require("../../../shared/http");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userName = String(normalizeQueryParam(req.query?.userName) || "");
    const payload = await listNotes(userName);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load notes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const note = await createNote(req.body || {});
    return res.status(201).json({ note });
  } catch (error) {
    return res.status(400).json({
      error: String(error.message || "Failed to save note"),
    });
  }
});

router.delete("/", async (req, res) => {
  try {
    const removed = await removeNote(req.body || {});
    return res.json({ removed });
  } catch (error) {
    return res.status(400).json({ error: "Failed to delete note" });
  }
});

module.exports = router;
