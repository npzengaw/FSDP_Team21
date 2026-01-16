import "./KanbanBoard.css";
import React, { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

/**
 * EXPECTS:
 * <KanbanBoard socket={socket} user={user} profile={profile} />
 * socket should be connected with query: { userId: user.id }
 *
 * Server must expose:
 * GET http://localhost:5000/api/models -> { models: string[], defaultModel: string }
 */
function KanbanBoard({ socket, user, profile }) {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState({ todo: [], progress: [], done: [] });

  // Popup: prompt AI from TODO/backlog
  const [showPromptPopup, setShowPromptPopup] = useState(false);
  const [selectedBacklogTask, setSelectedBacklogTask] = useState(null);
  const [aiPrompt, setAiPrompt] = useState("");

  // AI model dropdown
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(true);

  // Done popup
  const [selectedDoneTask, setSelectedDoneTask] = useState(null);

  // ---------- LOAD AI MODELS (dropdown) ----------
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/models");
        const json = await res.json();

        const list = Array.isArray(json.models) ? json.models : [];
        setModels(list);

        const def = json.defaultModel || list[0] || "";
        setSelectedModel(def);
      } catch (err) {
        console.error("Failed to load AI models:", err);
        setModels([]);
        setSelectedModel("");
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  // ---------- SOCKET DEBUG (optional) ----------
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => console.log("✅ socket connected:", socket.id);
    const onDisconnect = () => console.log("❌ socket disconnected");
    const onErr = (e) => console.log("❌ socket connect_error:", e?.message || e);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onErr);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onErr);
    };
  }, [socket]);

  // ----------- LOAD TASKS + REALTIME -----------
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          description,
          type,
          priority,
          estimation,
          status,
          user_id,
          assigned_to,
          created_at,
          updated_at,
          ai_output,
          ai_agent,
          ai_status,
          profiles:user_id (username)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Kanban fetchTasks error:", error);
      setTasks(Array.isArray(data) ? data : []);
    };

    fetchTasks();

    const channel = supabase
      .channel(`kanban_tasks_personal_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        fetchTasks
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // show tasks assigned to you OR unassigned
  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks.filter((t) => t.assigned_to === user.id || t.assigned_to == null);
  }, [tasks, user]);

  // Build columns
  useEffect(() => {
    const safe = Array.isArray(myTasks) ? myTasks : [];
    setColumns({
      todo: safe.filter((t) => t.status === "todo"),
      progress: safe.filter((t) => t.status === "progress"),
      done: safe.filter((t) => t.status === "done"),
    });
  }, [myTasks]);

  // DRAG & DROP (manual)
  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    const moved = columns[source.droppableId][source.index];
    if (!moved) return;

    // block dragging while AI is thinking/queued
    if (moved.ai_status === "thinking" || moved.ai_status === "queued") return;

    // Optimistic UI
    const nextCols = { ...columns };
    nextCols[source.droppableId] = [...nextCols[source.droppableId]];
    nextCols[destination.droppableId] = [...nextCols[destination.droppableId]];

    nextCols[source.droppableId].splice(source.index, 1);
    nextCols[destination.droppableId].splice(destination.index, 0, {
      ...moved,
      status: destination.droppableId,
    });
    setColumns(nextCols);

    const { error } = await supabase
      .from("tasks")
      .update({ status: destination.droppableId, updated_at: new Date().toISOString() })
      .eq("id", moved.id)
      .eq("user_id", user.id);

    if (error) console.error("Kanban move update error:", error);
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
    if (error) console.error("Kanban delete error:", error);
  };

  // TODO: CLICK -> PROMPT POPUP
  const openPromptPopup = (task) => {
    setSelectedBacklogTask(task);
    setAiPrompt("");

    // if models loaded and nothing selected yet, default to first
    setSelectedModel((prev) => prev || models[0] || "");

    setShowPromptPopup(true);
  };

  const closePromptPopup = () => {
    setShowPromptPopup(false);
    setSelectedBacklogTask(null);
    setAiPrompt("");
  };

  // Generate: close popup instantly + move to progress instantly + queue on server
  const handleGenerate = async () => {
    if (!user) return;
    if (!socket) {
      console.error("❌ No socket passed into KanbanBoard.");
      return;
    }
    if (!selectedBacklogTask?.id) return;

    const cleanPrompt = String(aiPrompt || "").trim();
    if (!cleanPrompt) return;

    const modelToUse = String(selectedModel || "").trim();
    if (!modelToUse) return;

    const taskId = selectedBacklogTask.id;

    // close popup instantly
    setShowPromptPopup(false);
    setSelectedBacklogTask(null);
    setAiPrompt("");

    // optimistic: move instantly to progress + queued
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "progress",
        ai_status: "queued",
        // optional: show selected model immediately on UI
        ai_agent: modelToUse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Optimistic progress update error:", error);
      return;
    }

    // enqueue on server with model
    socket.emit("generateFromWorkItem", { taskId, prompt: cleanPrompt, model: modelToUse });
  };

  // DONE: open popup
  const openDonePopup = (task) => setSelectedDoneTask(task);

  // DONE: reset to todo (repeat cycle)
  const resetDoneToTodo = async (taskId) => {
    if (!user) return;

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "todo",
        ai_status: "idle",
        ai_output: null,
        ai_agent: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (error) console.error("Reset to todo error:", error);
    setSelectedDoneTask(null);
  };

  // Keep done popup updated if realtime changes
  useEffect(() => {
    if (!selectedDoneTask) return;
    const updated = tasks.find((t) => t.id === selectedDoneTask.id);
    if (updated) setSelectedDoneTask(updated);
  }, [tasks, selectedDoneTask]);

  return (
    <div className="kanban-container">
      <div className="main-content">
        {/* Header */}
        <div className="header" style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="welcome">Personal Board</div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: "16px" }}>
            <span style={{ cursor: "pointer", fontWeight: 600 }}>Kanban Board</span>
            <span style={{ cursor: "pointer", color: "#666" }} onClick={() => navigate("/workitems")}>
              WorkItems
            </span>
          </div>
        </div>

        <div className="board">
          <DragDropContext onDragEnd={onDragEnd}>
            {Object.entries(columns).map(([colId, list]) => (
              <Droppable droppableId={colId} key={colId}>
                {(provided) => (
                  <div className={`column ${colId}`} ref={provided.innerRef} {...provided.droppableProps}>
                    <div className="column-header">
                      <div className="column-title">
                        {colId === "todo" && "To Do"}
                        {colId === "progress" && "In Progress"}
                        {colId === "done" && "Done"}
                      </div>

                      <div className="task-count">{list.length}</div>
                    </div>

                    <div className="tasks-list">
                      {list.map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided) => (
                            <div
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (task.status === "todo") openPromptPopup(task);
                                if (task.status === "done") openDonePopup(task);
                              }}
                              style={{
                                cursor: task.status === "progress" ? "default" : "pointer",
                                opacity: task.ai_status === "thinking" ? 0.9 : 1,
                              }}
                            >
                              <button
                                className="task-menu"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                }}
                              >
                                ✕
                              </button>

                              <div className="task-title">{task.title}</div>

                              <div className="task-created-by">
                                Created by: {task.profiles?.username || profile?.username || "Unknown"}
                              </div>

                              {task.status === "todo" && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                                  Click to prompt AI →
                                </div>
                              )}

                              {task.ai_status === "queued" && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                                  Queued...
                                </div>
                              )}

                              {task.ai_status === "thinking" && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                                  AI generating...
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </DragDropContext>
        </div>
      </div>

      {/* PROMPT POPUP */}
      {showPromptPopup && selectedBacklogTask && (
        <div className="popup-overlay" onClick={closePromptPopup}>
          <div className="popup-card large" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={closePromptPopup} type="button">
              ✕
            </button>

            <h3>Prompt AI</h3>

            <div style={{ marginTop: 8, fontWeight: 700 }}>{selectedBacklogTask.title}</div>

            {selectedBacklogTask.description && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
                {selectedBacklogTask.description}
              </div>
            )}

            {/* MODEL SELECT */}
            <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>AI Model</label>
            <select
              value={selectedModel}
              disabled={loadingModels || models.length === 0}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #dcdcdc",
                fontSize: 14,
                background: "white",
              }}
            >
              {loadingModels && <option>Loading models...</option>}
              {!loadingModels && models.length === 0 && <option value="">No models available</option>}
              {!loadingModels &&
                models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>

            <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>Prompt *</label>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Write what you want the AI to do for this task..."
              rows={6}
              style={{ width: "100%", padding: 10, borderRadius: 10 }}
            />

            <div className="popup-actions" style={{ marginTop: 14 }}>
              <button className="cancel-btn" onClick={closePromptPopup} type="button">
                Cancel
              </button>

              <button
                className="add-btn"
                onClick={handleGenerate}
                disabled={!String(aiPrompt).trim() || !selectedModel || loadingModels}
                type="button"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DONE MODAL (professional) */}
      {selectedDoneTask && (
        <div className="modal-overlay" onClick={() => setSelectedDoneTask(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <h2 className="modal-title">{selectedDoneTask.title}</h2>
                <div className="modal-subtitle">
                  AI Agent: <span>{selectedDoneTask.ai_agent || "None"}</span>
                </div>
              </div>

              <button className="modal-close" onClick={() => setSelectedDoneTask(null)} type="button">
                ✕
              </button>
            </div>

            {selectedDoneTask.description && <div className="modal-desc">{selectedDoneTask.description}</div>}

            <div className="modal-section">
              <div className="section-label">AI Output</div>
              <pre className="output-box">{selectedDoneTask.ai_output || "No AI output."}</pre>
            </div>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => resetDoneToTodo(selectedDoneTask.id)}
                type="button"
              >
                Reset to TODO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
