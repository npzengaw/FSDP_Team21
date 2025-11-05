// ====================== ENV & IMPORTS ======================
require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ✅ Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ====================== AI via OpenRouter (Claude Example) ======================
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
          {
            role: "system",
            content: "You are an expert AI coding agent. Be concise and technical.",
          },
          {
            role: "user",
            content: `Task: ${taskTitle}. Provide a short technical progress update.`,
          },
        ],
      }),
    });

    const data = await response.json();

    const output = data.choices?.[0]?.message?.content || "No response from AI.";
    const modelUsed = data.model || "Claude-3-Haiku"; // fallback label
    return { output, modelUsed };
  } catch (error) {
    console.error("Claude error:", error);
    return { output: "AI could not process this task.", modelUsed: "Claude-3-Haiku" };
  }
}

// ====================== Supabase Helpers ======================
async function getAllTasks() {
  const { data, error } = await supabase.from("tasks").select("*");
  if (error) console.error("❌ Supabase Read Error:", error);
  return data || [];
}

async function insertTask({ title }) {
  const { error } = await supabase.from("tasks").insert([{ title, status: "todo" }]);
  if (error) console.error("❌ Supabase Insert Error:", error);
}


async function updateTask(taskId, updates) {
  const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
  if (error) console.error("❌ Supabase Update Error:", error);
}

// ====================== EXPRESS + SOCKET ======================
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
  },
});

// ====================== SOCKET EVENTS ======================
io.on("connection", async (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.emit("loadTasks", await getAllTasks());

  socket.on("addTask", async ({ title }) => {
  await insertTask({ title }); // no manual id
  io.emit("updateTasks", await getAllTasks());
  console.log(`🆕 New task added: ${title}`);
  });


  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    await updateTask(taskId, { status: newStatus, updated_at: new Date().toISOString() });
    io.emit("updateTasks", await getAllTasks());
    console.log(`📦 Task "${taskId}" moved to "${newStatus}"`);
  });

  socket.on("renameTask", async ({ taskId, newTitle }) => {
  await updateTask(taskId, { title: newTitle });
  io.emit("updateTasks", await getAllTasks());
  console.log(`✏️ Task "${taskId}" renamed to "${newTitle}"`);
  });

  socket.on("deleteTask", async ({ taskId }) => { 
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) console.error("❌ Delete error:", error);
    io.emit("updateTasks", await getAllTasks());
    console.log(`🗑️ Task "${taskId}" deleted`);
  });


  socket.on("disconnect", () => console.log("❌ User disconnected:", socket.id));
});

// ====================== AI TASK LOOP ======================
// 💡 Every cycle:
// 1. If there's a progress task older than 10s, finish it.
// 2. Else, pick a todo and mark it as progress.
setInterval(async () => {
  const now = Date.now();

  // 1️⃣ Finish any progress task older than 10s
  const { data: progressTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "progress");

  if (progressTasks && progressTasks.length > 0) {
    for (const task of progressTasks) {
      const lastUpdated = new Date(task.updated_at || task.created_at).getTime();
      if (now - lastUpdated > 10000) {
        console.log(`🤖 Claude finishing task: ${task.title}`);
        const { output, modelUsed } = await processTaskWithClaude(task.title);
        await updateTask(task.id, {
          status: "done",
          ai_output: output,
          ai_agent: modelUsed,
        });
      }
    }
  } else {
    // 2️⃣ Start next task if no progress ones
    const { data: todoTask } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "todo")
      .limit(1)
      .single();

    if (todoTask) {
      console.log(`🚀 Starting new task: ${todoTask.title}`);
      await updateTask(todoTask.id, {
        status: "progress",
        updated_at: new Date().toISOString(),
      });
    }
  }

  io.emit("updateTasks", await getAllTasks());
}, 7000);

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
