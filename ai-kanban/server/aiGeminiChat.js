
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


// simple in-memory sessions (like Meta AI)
const sessions = new Map();

async function handleGeminiChat(req, res) {
  const { sessionId, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  const history =
    sessions.get(sessionId) || [
      {
        role: "user",
        parts: [{ text: "You are a helpful AI assistant." }],
      },
    ];

  try {
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    history.push(
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: reply }] }
    );

    // basic safety
    if (history.length > 20) history.splice(1, 10);

    sessions.set(sessionId, history);

    res.json({ reply });
  } catch (e) {
    console.error("Gemini error:", e);
    res.status(500).json({ error: "AI failed" });
  }
}

module.exports = { handleGeminiChat };
