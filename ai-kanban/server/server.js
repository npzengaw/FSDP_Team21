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
          ...history // Pass full conversation
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
  ai_status,
  ai_history,
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

    if (error) {
      console.error("Add task error:", error);
      return;
    }

    await emitPersonalTasks(io, socket.userId);
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

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
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

// ====================== AI AUTO LOOP (PERSONAL-AWARE) ======================


// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
