const { getActiveDeadlines } = require("../backend/src/services/deadlinesService");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const limit = Number(req.query?.limit || 12);
    const includeClosed = String(req.query?.includeClosed || "").toLowerCase() === "true";
    const data = await getActiveDeadlines({ limit, includeClosed });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch deadlines",
      details:
        process.env.NODE_ENV === "development"
          ? String(error.message || error)
          : undefined,
    });
  }
};
