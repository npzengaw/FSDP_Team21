aiAgent.js
// src/aiAgent.js (CommonJS)
// Hugging Face Inference Providers via OpenAI-compatible router

const OpenAI = require("openai");

const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL =
  process.env.HF_MODEL || "Qwen/Qwen2.5-Coder-7B-Instruct:featherless-ai";

if (!HF_TOKEN) {
  throw new Error("Missing HF_TOKEN in .env");
}

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: HF_TOKEN,
});

function toMessages(chatHistory, userMessage) {
  const messages = [];

  // system prompt (important for coding quality)
  messages.push({
    role: "system",
    content: "You are a helpful AI coding assistant. Be concise and correct.",
  });

  for (const h of chatHistory || []) {
    const text =
      h?.parts?.map((p) => p?.text).filter(Boolean).join("\n") || "";
    if (!text) continue;

    if (h.role === "user") {
      messages.push({ role: "user", content: text });
    } else {
      messages.push({ role: "assistant", content: text });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

async function runAIAgent(chatHistory, userMessage) {
  const messages = toMessages(chatHistory, userMessage);

  const completion = await client.chat.completions.create({
    model: HF_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 500,
  });

  return completion.choices[0].message.content;
}

module.exports = { runAIAgent };
