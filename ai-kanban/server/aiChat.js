// aiChat.js (CommonJS)
console.log("✅ aiChat.js loaded (version: 2026-02-01-1)");

const { runAIAgent } = require("./aiAgent.js");
console.log("✅ runAIAgent type =", typeof runAIAgent);

// In-memory session store
const sessions = new Map();


async function runAIAgent(prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3-haiku",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}



async function handleAIChat(req, res) {
  const { sessionId, message } = req.body || {};

  if (!message) return res.status(400).json({ error: "Message required" });

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

    if (history.length > 30) history.splice(1, 10);
    sessions.set(key, history);

    return res.json({ reply });
  } catch (err) {
    console.error("AI failed:", err);
    return res.status(500).json({
      error: "AI failed",
      details: err?.message || "unknown error",
    });
  }
}

module.exports = { handleAIChat };
