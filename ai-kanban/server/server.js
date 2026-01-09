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
async function processTaskWithClaude(taskTitle) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Aether Kanban AI Agent",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: "You are an expert AI coding agent. Be concise." },
          { role: "user", content: `Task: ${taskTitle}. Provide a short progress update.` },
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
  created_at,
  updated_at,
  ai_output,
  ai_agent,
  profiles:user_id (
    username
  )
`;

async function getPersonalTasks(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getPersonalTasks error:", error);
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
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// ====================== SOCKET EVENTS ======================
io.on("connection", async (socket) => {
  const { userId } = socket.handshake.query;

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

  // Add task (personal only)
  socket.on("addTask", async ({ title }) => {
    if (!title || !String(title).trim()) return;

    // ⚠️ IMPORTANT:
    // This insert assumes your "tasks" table allows organisation_id to be NULL
    // and does not require is_main_board.
    const { error } = await supabase.from("tasks").insert([
      {
        title: String(title).trim(),
        status: "todo",
        user_id: socket.userId,
      },
    ]);

    if (error) {
      console.error("Add task error:", error);
      return;
    }

    await emitPersonalTasks(io, socket.userId);
  });

  // Move task
  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    if (!taskId || !newStatus) return;

    await updateTask(taskId, {
      status: newStatus,
      updated_at: new Date().toISOString(),
    });

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

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) console.error("Delete error:", error);

    await emitPersonalTasks(io, socket.userId);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ====================== AI AUTO LOOP (PERSONAL-AWARE) ======================
setInterval(async () => {
  const now = Date.now();

  // 1) Finish old progress tasks (all users)
  const { data: progressTasks, error: progressErr } = await supabase
    .from("tasks")
    .select("id, title, user_id, updated_at, created_at")
    .eq("status", "progress");

  if (progressErr) console.error("progressTasks error:", progressErr);

  if (progressTasks?.length) {
    for (const task of progressTasks) {
      const lastUpdate = new Date(task.updated_at || task.created_at).getTime();

      if (now - lastUpdate > 10000) {
        const { output, modelUsed } = await processTaskWithClaude(task.title);

        await updateTask(task.id, {
          status: "done",
          ai_output: output,
          ai_agent: modelUsed,
          updated_at: new Date().toISOString(),
        });

        // push updated list to that user only
        if (task.user_id) await emitPersonalTasks(io, task.user_id);
      }
    }
    return;
  }

  // 2) Start next todo (one task globally)
  const { data: todo, error: todoErr } = await supabase
    .from("tasks")
    .select("id, user_id")
    .eq("status", "todo")
    .limit(1)
    .single();

  if (todoErr && todoErr.code !== "PGRST116") console.error("todo error:", todoErr);

  if (todo) {
    await updateTask(todo.id, {
      status: "progress",
      updated_at: new Date().toISOString(),
    });

    if (todo.user_id) await emitPersonalTasks(io, todo.user_id);
  }
}, 7000);

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
