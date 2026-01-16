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
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "KIRO Kanban",
        },
        body: JSON.stringify({
          model: safeModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert assistant. Be direct and concise. Output the final answer.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 700,
        }),
      }
    );

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

async function emitPersonalTasks(ioInstance, userId) {
  const tasks = await getPersonalTasks(userId);
  ioInstance.to(`user:${userId}`).emit("updateTasks", tasks);
}

// ====================== PER-USER AI QUEUE ======================
// userId -> { running: boolean, queue: Array<{ taskId, prompt, model }> }
const userQueues = new Map();

function getQueue(userId) {
  if (!userQueues.has(userId)) {
    userQueues.set(userId, { running: false, queue: [] });
  }
  return userQueues.get(userId);
}

async function generateOneWorkItem(userId, taskId, prompt, model) {
  if (!taskId || !prompt || !String(prompt).trim()) return;

  const safeModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  // 1) Load existing task (must belong to this user)
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id,title,description,type,priority,estimation,assigned_to,user_id,status")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (taskErr || !task) {
    console.error("generateOneWorkItem load task error:", taskErr);
    return;
  }

  // 2) Build ONE prompt
  const fullPrompt = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    task.type ? `Type: ${task.type}` : "",
    task.priority ? `Priority: ${task.priority}` : "",
    task.estimation ? `Estimation: ${task.estimation}` : "",
    `User prompt: ${String(prompt).trim()}`,
    "",
    "Output the final answer for this task now.",
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();

  // 3) Mark as thinking + progress
  await updateTask(taskId, {
    ai_status: "thinking",
    status: "progress",
    updated_at: new Date().toISOString(),
  });
  await emitPersonalTasks(io, userId);

  // 4) AI call (model chosen by user)
  const { output, modelUsed } = await processTaskWithOpenRouter(fullPrompt, safeModel);

  // 5) Force minimum progress time (make it visible)
  const MIN_PROGRESS_MS = 6000; // adjust if you want longer
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_PROGRESS_MS) await sleep(MIN_PROGRESS_MS - elapsed);

  // 6) Save + move to done
  await updateTask(taskId, {
    ai_output: output,
    ai_agent: modelUsed, // store actual model used
    ai_status: "done",
    status: "done",
    updated_at: new Date().toISOString(),
  });
  await emitPersonalTasks(io, userId);
}

async function runQueueForUser(userId) {
  const q = getQueue(userId);
  if (q.running) return;

  q.running = true;

  while (q.queue.length > 0) {
    const job = q.queue.shift();
    if (!job) continue;

    try {
      await generateOneWorkItem(userId, job.taskId, job.prompt, job.model);
    } catch (e) {
      console.error("Queue job failed:", e);
    }
  }

  q.running = false;
}

// ====================== SOCKET EVENTS ======================
io.on("connection", async (socket) => {
  const { userId } = socket.handshake.query;

  if (!userId) {
    console.log("❌ Socket missing userId, disconnecting");
    socket.disconnect(true);
    return;
  }

  socket.userId = userId;

  // Join personal room
  socket.join(`user:${userId}`);
  console.log(`🔗 User ${socket.id} joined Personal Room user:${userId}`);

  // Initial load (if any client listens)
  socket.emit("loadTasks", await getPersonalTasks(userId));

  // ====================== ADD TASK (simple) ======================
  socket.on("addTask", async ({ title }) => {
    if (!title || !String(title).trim()) return;

    const { error } = await supabase.from("tasks").insert([
      {
        title: String(title).trim(),
        user_id: socket.userId,
        status: "todo",
        ai_status: "idle",
        ai_output: null,
        ai_agent: null,
      },
    ]);

    if (error) {
      console.error("Add task error:", error);
      return;
    }

    await emitPersonalTasks(io, socket.userId);
  });

  // ====================== MOVE TASK (manual drag) ======================
  socket.on("taskMoved", async ({ taskId, newStatus }) => {
    if (!taskId || !newStatus) return;

    await updateTask(taskId, {
      status: newStatus,
      updated_at: new Date().toISOString(),
    });

    await emitPersonalTasks(io, socket.userId);
  });

  // ====================== DELETE TASK ======================
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

  // ======================
  // AI GENERATE (QUEUED + MODEL PICK):
  // payload: { taskId, prompt, model }
  // ======================
  socket.on("generateFromWorkItem", async ({ taskId, prompt, model }) => {
    try {
      if (!taskId || !prompt || !String(prompt).trim()) return;

      const cleanPrompt = String(prompt).trim();
      const safeModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

      const q = getQueue(socket.userId);

      // prevent duplicate queueing same taskId
      const alreadyQueued = q.queue.some((j) => j.taskId === taskId);
      if (alreadyQueued) return;

      // Push to queue (keep model per job)
      q.queue.push({ taskId, prompt: cleanPrompt, model: safeModel });

      // Mark queued (if client didn't already)
      await updateTask(taskId, {
        ai_status: "queued",
        status: "progress",
        // (optional) store the chosen model immediately so UI can show it
        ai_agent: safeModel,
        updated_at: new Date().toISOString(),
      });
      await emitPersonalTasks(io, socket.userId);

      // Start worker
      runQueueForUser(socket.userId);
    } catch (e) {
      console.error("generateFromWorkItem enqueue error:", e);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ====================== START SERVER ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
