
// aiChat.js (CommonJS)
const { runAIAgent } = require("./aiAgent");

// In-memory session store
const sessions = new Map();

async function handleAIChat(req, res) {
  const { sessionId, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  const key = sessionId || "anon";

  const history =
    sessions.get(key) || [
      {
        role: "user",
        parts: [{ text: "You are a helpful AI assistant. Be concise and clear." }],
      },
    ];

  try {
    const reply = await runAIAgent(history, message);

    history.push(
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: reply }] }
    );

    // keep memory bounded
    if (history.length > 30) history.splice(1, 10);

    sessions.set(key, history);

    return res.json({ reply });
  } catch (err) {
    console.error("AI failed:", err);
    return res.status(500).json({ error: "AI failed" });
  }
}

module.exports = { handleAIChat };
