require("dotenv").config();
const express = require("express");
const cors = require("cors");
const papersRouter = require("./routes/papers");
const deadlinesRouter = require("./routes/deadlines");
const notesRouter = require("./routes/notes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Research Paper Scraper API" });
});

app.use("/api/papers", papersRouter);
app.use("/api/deadlines", deadlinesRouter);
app.use("/api/notes", notesRouter);

app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
