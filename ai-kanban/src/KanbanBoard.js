import "./KanbanBoard.css";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Lottie from "lottie-react";
import boardAnim from "./assets/lottie/board.json";
import deleteAnim from "./assets/lottie/delete.json";
import emptySpaceImg from "./assets/EmptySpace.jpg";
import queuedAnim from "./assets/lottie/queued.json";


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

  // Header task search (global)
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const taskRefs = useRef({});

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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Organisation name
  const [orgName, setOrgName] = useState("");

  //Profile icon

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  const displayName =
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "User";

  const initial = String(displayName).trim().charAt(0).toUpperCase() || "U";
  const queuedAnimData = queuedAnim?.default || queuedAnim;

  //Empty Column Image
  const getTypeClass = (type) => {
    const colors = ["t-red", "t-orange", "t-green", "t-teal", "t-blue", "t-indigo", "t-purple", "t-pink"];
    const s = String(type || "").toLowerCase().trim();
    if (!s) return "";
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return colors[hash % colors.length];
  };

  //Organisation Header for Board
  useEffect(() => {
    const fetchOrgName = async () => {
      if (!isOrgMode || !orgId) return;

      const { data, error } = await supabase
        .from("organisations") // <-- change if your table name differs
        .select("name") // <-- change if your column differs
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

  const formatDue = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  };

  const priorityLabel = (p) => {
    const v = String(p || "").toLowerCase();
    if (!v) return "—";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const typeLabel = (t) => {
    const v = String(t || "").toLowerCase();
    if (!v) return "—";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

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
        profiles:user_id (username),
        assignee:assigned_to (username)
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
  const filteredTasks = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return myTasks;

    return (myTasks || []).filter((t) => {
      const title = String(t.title || "").toLowerCase();
      const desc = String(t.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [myTasks, searchTerm]);

  const searchResults = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return [];

    return (myTasks || [])
      .filter((t) => {
        const title = String(t.title || "").toLowerCase();
        const desc = String(t.description || "").toLowerCase();
        return title.includes(q) || desc.includes(q);
      })
      .slice(0, 8);
  }, [myTasks, searchTerm]);

  // Build columns
  useEffect(() => {
    const safe = Array.isArray(filteredTasks) ? filteredTasks : [];
    setColumns({
      todo: safe.filter((t) => t.status === "todo"),
      progress: safe.filter((t) => t.status === "progress"),
      done: safe.filter((t) => t.status === "done"),
    });
  }, [filteredTasks]);

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

  const deleteTask = async () => {
    if (!deleteTarget?.id) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", deleteTarget.id)
      .or(`user_id.eq.${uid},assigned_to.eq.${uid}`);

    if (error) console.error("Kanban delete error:", error);

    setShowDeleteModal(false);
    setDeleteTarget(null);
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
  const jumpToTask = (taskId) => {
    const el = taskRefs.current[taskId];
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    el.classList.add("task-flash");
    setTimeout(() => el.classList.remove("task-flash"), 900);

    setSearchOpen(false);
    setSearchTerm(""); // ✅ add this line
  };

  useEffect(() => {
    if (!searchOpen) return;

    const onDocClick = () => setSearchOpen(false);
    document.addEventListener("click", onDocClick);

    return () => document.removeEventListener("click", onDocClick);
  }, [searchOpen]);

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;

    const now = new Date();
    // compare by date (ignore time)
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return end < today;
  };

  return (
    <div className="kanban-container">
      <div className="main-content">
        {/* Header */}
        <div className="header">
          <div className="header-left">
            <div className="header-title">
              <span className="page-title">
                {isOrgMode ? `${orgName || "Company Projects"} Board` : "Personal Board"}
              </span>

              <span className="page-icon">
                <Lottie animationData={boardAnim} loop autoplay />
              </span>
            </div>
          </div>

          <div className="header-right">
            {/* Search icon button */}
            <div className="header-action" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="icon-btn"
                aria-label="Search tasks"
                onClick={() => setSearchOpen((v) => !v)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {/* Popover search (only when clicked) */}
              {searchOpen && (
                <div className="search-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="search-popover-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>

                    <input
                      autoFocus
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search tasks"
                      aria-label="Search tasks"
                    />

                    <button
                      type="button"
                      className="icon-btn subtle"
                      aria-label="Close search"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="search-popover-body">
                    <div className="search-popover-body">
                      {!searchTerm.trim() ? (
                        <div className="search-hint">Type to search by task title or description…</div>
                      ) : searchResults.length === 0 ? (
                        <div className="search-empty-state">
                          <div className="empty-illus" aria-hidden="true">
                            {/* simple inline SVG illustration */}
                            <svg viewBox="0 0 120 120" width="92" height="92" fill="none">
                              <circle cx="58" cy="58" r="34" stroke="currentColor" strokeWidth="5" opacity="0.35" />
                              <path
                                d="M83 83l20 20"
                                stroke="currentColor"
                                strokeWidth="6"
                                strokeLinecap="round"
                                opacity="0.35"
                              />
                              <circle cx="30" cy="28" r="4" fill="currentColor" opacity="0.18" />
                              <circle cx="96" cy="36" r="6" fill="currentColor" opacity="0.12" />
                              <circle cx="20" cy="76" r="6" fill="currentColor" opacity="0.10" />
                            </svg>
                          </div>

                          <div className="empty-title">No Result Found</div>
                          <div className="empty-subtitle">No results found. Please try again.</div>
                        </div>
                      ) : (
                        <div className="search-results"></div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date (icon + text, same sizing) */}
            <div className="header-action">
              <span className="icon-inline" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 3v2m10-2v2M4 8h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="date-text">{todayLabel}</span>
            </div>

            {/* Avatar */}
            <div className="avatar-circle" title={displayName}>
              {initial}
            </div>
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
                      {list.length === 0 ? (
                        <div className="empty-column">
                          <img className="empty-column-img" src={emptySpaceImg} alt="No tasks" />
                          <div className="empty-column-text">
                            {colId === "todo" && "No tasks to start yet."}
                            {colId === "progress" && "Nothing in progress right now."}
                            {colId === "done" && "No completed tasks yet."}
                          </div>
                        </div>
                      ) : (
                        <>
                          {list.map((task, index) => {
                            const assigneeObj = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee;
                            const assigneeName = assigneeObj?.username || "";
                            const assigneeInitial = assigneeName
                              ? String(assigneeName).trim().charAt(0).toUpperCase()
                              : "";

                            return (
                              <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                                {(provided) => (
                                  <div
                                    className={`task-card priority-${String(task.priority || "").toLowerCase()}`}
                                    ref={(el) => {
                                      provided.innerRef(el);
                                      taskRefs.current[task.id] = el;
                                    }}
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
                                        setDeleteTarget(task);
                                        setShowDeleteModal(true);
                                      }}
                                      type="button"
                                    >
                                      ✕
                                    </button>

                                    {/* TOP TAGS (priority + type beside each other) */}
                                    <div className="task-top">
                                      <span className={`pill priority ${String(task.priority || "").toLowerCase()}`}>
                                        {priorityLabel(task.priority)}
                                      </span>

                                      {String(task.type || "").trim() ? (
                                        <span className={`pill type ${getTypeClass(task.type)}`}>
                                          {typeLabel(task.type)}
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* TITLE */}
                                    <div className="task-main">
  <div className="task-name" title={task.title}>
    {task.title}
  </div>

  {/* ✅ TODO hint stays */}
  {task.status === "todo" && (
    <div className="task-hint">Click to prompt AI →</div>
  )}

  {/* ✅ queued + thinking row */}
  {(task.ai_status === "queued" || task.ai_status === "thinking") && (
    <div className="ai-loading-row">
      <div className="queued-lottie">
        <Lottie animationData={queuedAnimData} loop autoplay />
      </div>
      <span className="task-hint subtle">AI generating...</span>
    </div>
  )}
</div>




                                    <div className="task-divider" />

                                    {/* BOTTOM ROW: avatars left, due date right */}
                                    <div className="task-bottom">
                                      <div className="avatar-stack">
                                        {task.assigned_to && assigneeInitial ? (
                                          <div className="avatar alt" title={`Assigned to: ${assigneeName}`}>
                                            {assigneeInitial}
                                          </div>
                                        ) : null}
                                      </div>

                                      {/* only show date if end_date exists */}
                                      {task.end_date ? (
                                        <div className={`due-wrap ${isOverdue(task.end_date) ? "overdue" : ""}`}>
                                          <svg
                                            className="due-icon"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            aria-hidden="true"
                                          >
                                            <path
                                              d="M7 3v2m10-2v2M4 8h16M6 5h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                            />
                                          </svg>

                                          <span className="due-date">{formatDue(task.end_date)}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </>
                      )}
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
              <button className="btn-primary" onClick={() => resetDoneToTodo(selectedDoneTask.id)} type="button">
                Reset to TODO
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            {/* put your lottie delete anim here */}
            <div className="delete-anim">
              <Lottie animationData={deleteAnim} loop={false} autoplay />
            </div>

            <h2 className="delete-title">Delete task</h2>
            <p className="delete-desc">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>?
              <br />
              This action cannot be undone.
            </p>

            <div className="delete-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>

              <button className="btn-danger" type="button" onClick={deleteTask}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;