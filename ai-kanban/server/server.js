// server.js (PERSONAL-ONLY + WORKITEM(BACKLOG) -> AI QUEUE (MODEL PICK) -> PROGRESS -> DONE)
require("dotenv").config();

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ====================== SUPABASE ======================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ====================== EXPRESS + SOCKET ======================
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

// ====================== OPENROUTER MODELS (CONTROLLED LIST) ======================
// Add / remove models here (frontend dropdown pulls from /api/models)
const ALLOWED_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3-haiku",
  "google/gemini-2.0-flash-001",
];

const DEFAULT_MODEL = "openai/gpt-4o-mini";

// Endpoint for frontend dropdown
app.get("/api/models", (req, res) => {
  res.json({ models: ALLOWED_MODELS, defaultModel: DEFAULT_MODEL });
});

// ====================== AI via OpenRouter (SINGLE SHOT) ======================
async function processTaskWithOpenRouter(prompt, model) {
  const safeModel = ALLOWED_MODELS.includes(model)
    ? model
    : DEFAULT_MODEL;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: "You are an expert AI coding assistant. Be concise." },
          ...history // Pass full conversation
        ],
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      let msg = text;
      try {
        msg = JSON.parse(text)?.error?.message || text;
      } catch {}
      throw new Error(msg);
    }

    const data = JSON.parse(text);
    const output = data.choices?.[0]?.message?.content || "No response.";

    return {
      output,
      modelUsed: data.model || safeModel,
    };
  } catch (err) {
    console.error("OpenRouter error:", err.message);
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
  estimation,
  status,
  user_id,
  assigned_to,
  organisation_id,
  is_main_board,
  created_at,
  updated_at,
  ai_output,
  ai_agent,
  ai_status,
  profiles:user_id ( username )
`;


async function getPersonalTasks(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect)
    .or(`and(organisation_id.is.null,user_id.eq.${userId}),assigned_to.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPersonalTasks error:", error);
    return [];
  }
  return data || [];
}

// ✅ Org WorkItems should show shared backlog:
// organisation_id = orgId AND is_main_board = true
async function getOrgWorkItems(orgId) {
  if (!orgId) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect)
    .eq("organisation_id", orgId)
    .eq("is_main_board", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getOrgWorkItems error:", error);
    return [];
  }
  return data || [];
}

async function updateTask(taskId, updates) {
  const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
  if (error) console.error("Update error:", error);
}

async function emitPersonalTasks(ioInstance, userId) {
  const tasks = await getPersonalTasks(userId);
  ioInstance.to(`user:${userId}`).emit("updateTasks", tasks);
}

// ====================== EXPRESS + SOCKET ======================
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

app.get("/health", (req, res) => res.send("ok"));

// ====================== REALTIME BRIDGE (Supabase -> Socket.io) ======================
supabase
  .channel("tasks-realtime-bridge")
  .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async (payload) => {
    try {
      const newRow = payload.new || null;
      const oldRow = payload.old || null;

      // 1) Personal rooms to refresh (creator + assignee + previous ones)
      const affectedUserIds = new Set();

      if (newRow?.user_id) affectedUserIds.add(newRow.user_id);
      if (newRow?.assigned_to) affectedUserIds.add(newRow.assigned_to);

      if (oldRow?.user_id) affectedUserIds.add(oldRow.user_id);
      if (oldRow?.assigned_to) affectedUserIds.add(oldRow.assigned_to);

      for (const uid of affectedUserIds) {
        if (!uid) continue;
        const tasks = await getPersonalTasks(uid);
        io.to(`user:${uid}`).emit("updateTasks", tasks);
      }

      // 2) Org room to refresh (shared backlog)
      const changedOrgId = newRow?.organisation_id || oldRow?.organisation_id;
      const isMain = (newRow?.is_main_board ?? oldRow?.is_main_board) === true;

      if (changedOrgId && isMain) {
        const orgTasks = await getOrgWorkItems(changedOrgId);
        io.to(`org:${changedOrgId}`).emit("updateOrgTasks", orgTasks);
      }
    } catch (e) {
      console.error("Realtime bridge handler error:", e);
    }
  })
  .subscribe((status) => console.log("📡 tasks-realtime-bridge status:", status));

// ====================== SOCKET EVENTS ======================
io.on("connection", async (socket) => {
  const { userId, orgId } = socket.handshake.query;

  if (!userId) {
    console.log("❌ Socket missing userId, disconnecting");
    socket.disconnect(true);
    return;
  }

  socket.userId = userId;

  // Join user room
  socket.join(`user:${userId}`);
  console.log(`🔗 User ${socket.id} joined Personal Room user:${userId}`);

  // Initial load
  socket.emit("loadTasks", await getPersonalTasks(userId));

  // Add task
  socket.on("addTask", async ({ title }) => {
    if (!title || !String(title).trim()) return;

    const { error } = await supabase.from("tasks").insert([
      {
        title: String(title).trim(),
        user_id: socket.userId,
        ai_history: [], // <-- initialize AI chat history
      },
    ]);

    if (error) return console.error("Add task error:", error);

    await emitPersonalTasks(io, userId);
  });

  // Move task
  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    if (!taskId || !newStatus) return;

    await updateTask(taskId, { status: newStatus, updated_at: new Date().toISOString() });
    await emitPersonalTasks(io, socket.userId);
  });

  // Rename task
  socket.on("renameTask", async ({ taskId, newTitle }) => {
    if (!taskId || !newTitle || !String(newTitle).trim()) return;

    await updateTask(taskId, { title: String(newTitle).trim() });
    await emitPersonalTasks(io, socket.userId);
  });

  // Delete task
  socket.on("deleteTask", async ({ taskId }) => {
    if (!taskId) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", socket.userId);

    if (error) console.error("Delete error:", error);

    await emitPersonalTasks(io, socket.userId);
  });

  // AI Prompt handler
socket.on("aiPrompt", async ({ taskId, prompt }) => {
  if (!taskId || !prompt) return;

  // 1️⃣ Get existing task history
  const { data: task } = await supabase
    .from("tasks")
    .select("ai_history,user_id")
    .eq("id", taskId)
    .single();

  const history = task.ai_history || [];

  // 2️⃣ Add user's message
  history.push({ role: "user", content: prompt });

  // 3️⃣ Mark task as thinking
  await updateTask(taskId, { ai_status: "thinking", ai_history: history });
  await emitPersonalTasks(io, socket.userId);

  // 4️⃣ Get AI response
  const { output, modelUsed } = await processTaskWithClaude(history);

  // 5️⃣ Add AI response to history
  history.push({ role: "assistant", content: output });

  // 6️⃣ Save updated history
  await updateTask(taskId, { ai_history: history, ai_agent: modelUsed, ai_status: "done" });

  // 7️⃣ Send updated tasks to client
  await emitPersonalTasks(io, task.user_id);
});


  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
