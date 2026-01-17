require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ====================== SUPABASE ======================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ====================== AI via OpenRouter ======================
async function processTaskWithClaude(history) {
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
          ...history,
        ],
      }),
    });

    const data = await response.json();
    const output = data.choices?.[0]?.message?.content || "No response.";
    return { output, modelUsed: data.model || "claude-3-haiku" };
  } catch (error) {
    console.error("Claude error:", error);
    return { output: "AI error", modelUsed: "claude-3-haiku" };
  }
}

// ====================== TASK HELPERS ======================
const taskSelect = `
  id,
  title,
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
  ai_history,
  profiles:user_id (
    username
  )
`;

// ✅ Personal board should show:
// - personal tasks: organisation_id IS NULL AND user_id = me
// - assigned tasks: assigned_to = me
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

async function emitPersonalTasks(io, userId) {
  const tasks = await getPersonalTasks(userId);
  io.to(`user:${userId}`).emit("updateTasks", tasks);
}

// ====================== EXPRESS + SOCKET ======================
const app = express();

/* ✅ FIX: CORS must allow BOTH localhost and 127.0.0.1 */
const ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
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

  // Personal room always
  socket.join(`user:${userId}`);
  socket.emit("loadTasks", await getPersonalTasks(userId));

  // Org room only when orgId exists (WorkItems org mode)
  if (orgId) {
    socket.join(`org:${orgId}`);
    socket.emit("loadOrgTasks", await getOrgWorkItems(orgId));
  }

  // ===== Personal board actions =====
  socket.on("addTask", async ({ title }) => {
    if (!title || !String(title).trim()) return;

    const { error } = await supabase.from("tasks").insert([
      {
        title: String(title).trim(),
        user_id: userId,
        ai_history: [],
        ai_status: "idle",
      },
    ]);

    if (error) return console.error("Add task error:", error);

    await emitPersonalTasks(io, userId);
  });

  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    if (!taskId || !newStatus) return;

    await updateTask(taskId, {
      status: newStatus,
      updated_at: new Date().toISOString(),
    });

    await emitPersonalTasks(io, userId);
  });

  socket.on("renameTask", async ({ taskId, newTitle }) => {
    if (!taskId || !newTitle || !String(newTitle).trim()) return;

    await updateTask(taskId, { title: String(newTitle).trim() });
    await emitPersonalTasks(io, userId);
  });

  socket.on("deleteTask", async ({ taskId }) => {
    if (!taskId) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) console.error("Delete error:", error);

    await emitPersonalTasks(io, userId);
  });

  socket.on("aiPrompt", async ({ taskId, prompt }) => {
    if (!taskId || !prompt) return;

    const { data: task, error } = await supabase
      .from("tasks")
      .select("ai_history,user_id")
      .eq("id", taskId)
      .single();

    if (error || !task) {
      console.error("aiPrompt fetch task error:", error);
      return;
    }

    const history = task.ai_history || [];
    history.push({ role: "user", content: prompt });

    await updateTask(taskId, { ai_status: "thinking", ai_history: history });
    await emitPersonalTasks(io, task.user_id);

    const { output, modelUsed } = await processTaskWithClaude(history);

    history.push({ role: "assistant", content: output });

    await updateTask(taskId, {
      ai_history: history,
      ai_agent: modelUsed,
      ai_status: "done",
      ai_output: output,
      updated_at: new Date().toISOString(),
    });

    await emitPersonalTasks(io, task.user_id);
  });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
