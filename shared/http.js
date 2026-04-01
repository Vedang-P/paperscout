function normalizeQueryParam(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function parseInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  const parsed = Number.isFinite(numeric) ? numeric : fallback;
  const boundedMin = Number.isFinite(min) ? min : parsed;
  const boundedMax = Number.isFinite(max) ? max : parsed;
  return Math.min(Math.max(parsed, boundedMin), boundedMax);
}

function parseBody(req) {
  if (!req || req.body === undefined || req.body === null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function methodNotAllowed(req, res, methods = ["GET"]) {
  const allowed = Array.isArray(methods) ? methods.join(", ") : String(methods || "GET");
  res.setHeader("Allow", allowed);
  return res.status(405).json({ error: "Method Not Allowed" });
}

module.exports = {
  normalizeQueryParam,
  parseBoolean,
  parseInteger,
  parseBody,
  methodNotAllowed,
};
