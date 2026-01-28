import "./KanbanBoard.css";
import React, { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Lottie from "lottie-react";
import boardAnim from "./assets/lottie/board.json"; // adjust path if needed


function KanbanBoard({ socket, user, profile }) {
  const navigate = useNavigate();

  const { id: orgId } = useParams();
  const uid = user?.id;
  const isOrgMode = !!orgId;

    // ✅ remember current org so /home and sidebar can route correctly
  useEffect(() => {
    if (isOrgMode && orgId) {
      localStorage.setItem("activeOrgId", orgId);
    }
  }, [isOrgMode, orgId]);

  
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

  // Organisation name
  const [orgName, setOrgName] = useState("");


  //Organisation Header for Board
  useEffect(() => {
  const fetchOrgName = async () => {
    if (!isOrgMode || !orgId) return;

    const { data, error } = await supabase
      .from("organisations")   // <-- change if your table name differs
      .select("name")          // <-- change if your column differs
      .eq("id", orgId)
      .single();

    if (error) {
      console.error("Fetch org name error:", error);
      setOrgName("Company Projects");
      return;
    }

    setOrgName(data?.name || "Company Projects");
  };

  fetchOrgName();
}, [isOrgMode, orgId]);


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
  if (!uid) return;

  const fetchTasks = async () => {
    let q = supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        type,
        priority,
        estimation,
        start_date,
        end_date,
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
        profiles:user_id (username)
      `)
      .order("created_at", { ascending: false });

    if (isOrgMode) {
      // ✅ personal tasks (mine) + org tasks assigned to me (ONLY this org)
      q = q.or(
        `and(organisation_id.is.null,user_id.eq.${uid}),and(organisation_id.eq.${orgId},assigned_to.eq.${uid})`
      );
    } else {
      // ✅ personal page only: ONLY my personal tasks
      q = q
        .is("organisation_id", null)
        .eq("user_id", uid);
    }

    const { data, error } = await q;
    if (error) console.error("Kanban fetchTasks error:", error);
    setTasks(Array.isArray(data) ? data : []);
  };

  fetchTasks();

  const channel = supabase
    .channel(`kanban_tasks_${uid}_${isOrgMode ? orgId : "personal"}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      fetchTasks
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [uid, isOrgMode, orgId]);


// ✅ ADD THIS RIGHT HERE
const myTasks = useMemo(() => {
  if (!uid) return [];
  return tasks.filter((t) => t.user_id === uid || t.assigned_to === uid);
}, [tasks, uid]);  

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

    // ✅ IMPORTANT: allow update if owner OR assignee
    const { error } = await supabase
      .from("tasks")
      .update({
        status: destination.droppableId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", moved.id)
      .or(`user_id.eq.${uid},assigned_to.eq.${uid}`);


    if (error) console.error("Kanban move update error:", error);
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete task?")) return;

    // ✅ allow delete if owner OR assignee (if you want ONLY owner can delete, tell me)
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .or(`user_id.eq.${uid},assigned_to.eq.${uid}`);


    if (error) console.error("Kanban delete error:", error);
  };

  // TODO: CLICK -> PROMPT POPUP
  const openPromptPopup = (task) => {
    setSelectedBacklogTask(task);
    setAiPrompt("");
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

    // ✅ allow update if owner OR assignee
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "progress",
        ai_status: "queued",
        ai_agent: modelToUse,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .or(`user_id.eq.${uid},assigned_to.eq.${uid}`);


    if (error) {
      console.error("Optimistic progress update error:", error);
      return;
    }

    // enqueue on server with model
    socket.emit("aiPrompt", {
      taskId,
      prompt: cleanPrompt,
      model: modelToUse,
    });
  };

  // DONE: open popup
  const openDonePopup = (task) => setSelectedDoneTask(task);

  // DONE: reset to todo (repeat cycle)
  const resetDoneToTodo = async (taskId) => {
    if (!user) return;

    // ✅ allow reset if owner OR assignee
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
      .or(`user_id.eq.${uid},assigned_to.eq.${uid}`);


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
        <div className="header">
  <div className="header-title">
    <span className="page-title">
      {isOrgMode
        ? `${orgName || "Company Projects"} Board`
        : "Personal Board"}
    </span>

    <span className="page-icon">
      <Lottie
        animationData={boardAnim}
        loop
        autoplay
      />
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

                              <div className="task-title" title={task.title}>
                                {task.title}
                              </div>


                              <div className="task-created-by">
                                Assigned by: {task.profiles?.username || profile?.username || "Unknown"}
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
