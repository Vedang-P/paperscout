require("dotenv").config();
const express = require("express");
const cors = require("cors");
const papersRouter = require("./routes/papers");
const deadlinesRouter = require("./routes/deadlines");
const notesRouter = require("./routes/notes");

const app = express();
const PORT = process.env.PORT || 5000;
const BODY_LIMIT = process.env.BODY_LIMIT || "256kb";

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
const corsOptions =
  allowedOrigins.length === 0
    ? {}
    : {
        origin(origin, callback) {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("CORS origin not allowed"));
        },
      };

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json({ limit: BODY_LIMIT }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "sarveshu-api",
    time: new Date().toISOString(),
  });
});

app.use("/api/papers", papersRouter);
app.use("/api/deadlines", deadlinesRouter);
app.use("/api/notes", notesRouter);
app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  if (error?.message === "CORS origin not allowed") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("Unhandled API error:", error?.message || error);
  return res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  return res.status(404).json({ error: "Not Found" });
});

const server = app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down server...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
