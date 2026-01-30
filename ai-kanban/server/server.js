
// server.js (CommonJS)
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const { handleGeminiChat } = require("./aiGeminiChat");
const { handleAIChat } = require("../src/aiChat.js");


// ✅ Node 18+ (including Node 24) has global fetch built-in.
// No node-fetch needed.

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// ====================== EXPRESS ======================
const app = express();

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json());

// Optional health check
app.get("/health", (_, res) => res.send("ok"));

// ✅ Don’t register the same route twice.
// Pick one, OR give them different endpoints:
app.post("/api/ai/chat", handleAIChat);
app.post("/api/ai/gemini", handleGeminiChat);

// ====================== SUPABASE ======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ====================== SERVER + SOCKET ======================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  maxHttpBufferSize: 5e6, // 5MB
});

// ====================== AI MODELS ======================
const ALLOWED_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3-haiku",
  "google/gemini-2.0-flash-001",
];
const DEFAULT_MODEL = "openai/gpt-4o-mini";

app.get("/api/models", (_, res) => {
  res.json({ models: ALLOWED_MODELS, defaultModel: DEFAULT_MODEL });
});

// ====================== OPENROUTER ======================
async function processTaskWithOpenRouter(history, model) {
  const safeModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: safeModel,
        messages: [
          { role: "system", content: "You are an expert AI coding assistant. Be concise." },
          ...history,
        ],
      }),
    });

    const data = await response.json();

    return {
      output: data.choices?.[0]?.message?.content || "No response.",
      modelUsed: data.model || safeModel,
    };
  } catch (err) {
    console.error("OpenRouter error:", err);
    return {
      output: `AI error: ${err.message}`,
      modelUsed: safeModel,
    };
  }
}

// ====================== TASK HELPERS ======================
const taskSelect = `
  id,
  title,
  description,
  type,
  priority,
  assigned_to,
  start_date,
  end_date,
  status,
  user_id,
  organisation_id,
  is_main_board,
  created_at,
  updated_at,
  ai_output,
  ai_agent,
  ai_status,
  ai_history
`;

async function getPersonalTasks(userId) {
  if (!userId) return [];

  const { data } = await supabase
    .from("tasks")
    .select(taskSelect)
    .or(`and(organisation_id.is.null,user_id.eq.${userId}),assigned_to.eq.${userId}`)
    .order("created_at", { ascending: false });

  return data || [];
}

async function getOrgWorkItems(orgId) {
  if (!orgId) return [];

  const { data } = await supabase
    .from("tasks")
    .select(taskSelect)
    .eq("organisation_id", orgId)
    .eq("is_main_board", true)
    .order("created_at", { ascending: false });

  return data || [];
}

async function emitPersonalTasks(userId) {
  io.to(`user:${userId}`).emit("updateTasks", await getPersonalTasks(userId));
}

// ====================== SUPABASE REALTIME BRIDGE ======================
supabase
  .channel("tasks-realtime-bridge")
  .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async (payload) => {
    try {
      const affectedUsers = new Set();

      if (payload.new?.user_id) affectedUsers.add(payload.new.user_id);
      if (payload.new?.assigned_to) affectedUsers.add(payload.new.assigned_to);
      if (payload.old?.user_id) affectedUsers.add(payload.old.user_id);
      if (payload.old?.assigned_to) affectedUsers.add(payload.old.assigned_to);

      for (const uid of affectedUsers) {
        if (uid) await emitPersonalTasks(uid);
      }

      const orgId = payload.new?.organisation_id || payload.old?.organisation_id;
      const isMain = (payload.new?.is_main_board ?? payload.old?.is_main_board) === true;

      if (orgId && isMain) {
        io.to(`org:${orgId}`).emit("updateOrgTasks", await getOrgWorkItems(orgId));
      }
    } catch (e) {
      console.error("Realtime bridge error:", e);
    }
  })
  .subscribe();

// ====================== SOCKET EVENTS ======================
io.on("connection", async (socket) => {
  const { userId, orgId } = socket.handshake.query;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${userId}`);
  socket.emit("loadTasks", await getPersonalTasks(userId));

  if (orgId) {
    socket.join(`org:${orgId}`);
    socket.emit("loadOrgTasks", await getOrgWorkItems(orgId));
  }

  socket.on("aiPrompt", async ({ taskId, prompt, model }) => {
    if (!taskId || !prompt) return;

    const { data: task } = await supabase
      .from("tasks")
      .select("ai_history,user_id")
      .eq("id", taskId)
      .single();

    const history = Array.isArray(task?.ai_history) ? [...task.ai_history] : [];
    history.push({ role: "user", content: prompt });

    await supabase
      .from("tasks")
      .update({ ai_status: "thinking", ai_history: history })
      .eq("id", taskId);

    await emitPersonalTasks(task.user_id);

    const { output, modelUsed } = await processTaskWithOpenRouter(history, model);

    history.push({ role: "assistant", content: output });

    await supabase
      .from("tasks")
      .update({
        ai_history: history,
        ai_output: output,
        ai_agent: modelUsed,
        ai_status: "done",
        status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    await emitPersonalTasks(task.user_id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

// ====================== START ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
