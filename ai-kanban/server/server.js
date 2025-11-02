// ====================== ENV & IMPORTS ======================
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// ✅ Initialize Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ====================== AI via CLAUDE (OpenRouter) ======================
async function processTaskWithClaude(taskTitle) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Aether Kanban AI Agent"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: "You are an expert AI coding agent. Be concise and technical." },
          { role: "user", content: `Task: ${taskTitle}. Provide a short technical progress update.` }
        ]
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response from Claude";
  } catch (error) {
    console.error("Claude error:", error);
    return "AI could not process this task.";
  }
}

// ====================== Supabase DB Helper Functions ======================
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
  cors: { origin: ["http://localhost:3000", "http://127.0.0.1:3000"], methods: ["GET", "POST"] }
});


// ====================== SOCKET.IO EVENTS ======================
io.on("connection", async (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.emit("loadTasks", await getAllTasks());

  socket.on("addTask", async ({ id, title }) => {
    await insertTask({ id, title, status: "todo" });
    io.emit("updateTasks", await getAllTasks());
    console.log(`🆕 New task added: ${title}`);
  });

  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    await updateTask(taskId, { status: newStatus });
    io.emit("updateTasks", await getAllTasks());
    console.log(`📦 Task "${taskId}" moved to "${newStatus}"`);
  });

  socket.on("disconnect", () => console.log("❌ User disconnected:", socket.id));
});

// ====================== AI TASK PROCESSOR ======================
setInterval(async () => {
  let { data: progressTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "progress")
    .limit(1)
    .single();

  if (progressTask) {
    console.log(`🤖 Claude working on: ${progressTask.title}`);
    const aiResponse = await processTaskWithClaude(progressTask.title);
    await updateTask(progressTask.id, { status: "done", ai_output: aiResponse });
  } else {
    let { data: todoTask } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "todo")
      .limit(1)
      .single();
    if (todoTask) {
      console.log(`🚀 Claude starting task: ${todoTask.title}`);
      await updateTask(todoTask.id, { status: "progress" });
    }
  }

  io.emit("updateTasks", await getAllTasks());
}, 7000);

// ====================== SERVER START ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
