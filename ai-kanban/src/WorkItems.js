import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, X, Search, Tag } from "lucide-react";
import { supabase } from "./supabaseClient";
import { io } from "socket.io-client";
import "./WorkItems.css";

/* ----------------------- AVATAR COLORS ----------------------- */
const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
];


const getAvatarColor = (userId) => {
  if (!userId) return AVATAR_COLORS[0];
  const index = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

const ProfileAvatar = ({ profile }) => {
  if (!profile) return null;
  const initial = profile.username?.charAt(0).toUpperCase() || "?";
  const bgColor = profile.avatar_color || getAvatarColor(profile.id);

  if (profile.avatar_url) {
    return (
      <div className="profile-avatar" title={profile.username}>
        <img src={profile.avatar_url} alt={profile.username} />
      </div>
    );
  }

  return (
    <div
      className="profile-avatar"
      style={{ backgroundColor: bgColor }}
      title={profile.username}
    >
      {initial}
    </div>
  );
};

/* ----------------------- TYPE COLORS ----------------------- */
const TYPE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#84cc16",
  "#eab308",
];

const getTypeColor = (typeName) => {
  if (!typeName || typeof typeName !== "string") return "#e5e7eb";
  const safe = String(typeName).toLowerCase();
  const hash = safe.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return TYPE_COLORS[hash % TYPE_COLORS.length];
};

export default function WorkItems({ user, profile }) {
  const navigate = useNavigate();
  const { id: orgId } = useParams();
  const isOrgMode = !!orgId;

  useEffect(() => {
  if (isOrgMode && orgId) {
    localStorage.setItem("activeOrgId", orgId);
  }
}, [isOrgMode, orgId]);


  const socketRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [assignedProfiles, setAssignedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    progress: true,
    done: true,
  });

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [taskLocation, setTaskLocation] = useState("status:todo");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type: "",
    priority: "Medium",
    assigned_to: null,
    start_date: "",
    end_date: "",
  });

  // ===== AUTH GUARD =====
  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // =========================================================
  // ✅ LIVE TASKS VIA SOCKET (PERSONAL + ORG)
  // =========================================================
useEffect(() => {
  if (!user) return;

  setLoading(true);

  const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

  // always recreate when org changes
  if (socketRef.current) {
    socketRef.current.disconnect();
    socketRef.current = null;
  }

  socketRef.current = io(SERVER_URL, {
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 500,
    timeout: 5000,
    query: {
      userId: user.id,
      orgId: isOrgMode ? orgId : undefined,
    },
  });

  const s = socketRef.current;

  const onLoad = (list) => {
    if (Array.isArray(list)) setTasks(list);
    setLoading(false);
  };

  const onErr = (e) => {
    console.log("❌ WorkItems socket error:", e?.message || e);
    setLoading(false);
  };

  s.on("loadTasks", onLoad);
  s.on("updateTasks", onLoad);
  s.on("loadOrgTasks", onLoad);
  s.on("updateOrgTasks", onLoad);
  s.on("connect_error", onErr);

  return () => {
  s.off("loadTasks", onLoad);
  s.off("updateTasks", onLoad);
  s.off("loadOrgTasks", onLoad);
  s.off("updateOrgTasks", onLoad);
  s.off("connect_error", onErr);
  s.disconnect();
};
}, [user, orgId, isOrgMode]);



useEffect(() => {
  const s = socketRef.current;
  if (!s || !user || !s.connected) return;

  s.emit("rejoin", {
    userId: user.id,
    orgId: isOrgMode ? orgId : null,
  });
}, [user, orgId, isOrgMode]);



  // =========================================================
  // ✅ KEEP MODAL IN SYNC WITH LIVE TASK UPDATES
  // =========================================================
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  // ===== LOAD ASSIGNEES =====
  useEffect(() => {
    if (!user) return;

    const loadProfiles = async () => {
      if (!isOrgMode) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, avatar_color");

        if (error) console.error("loadProfiles error:", error);
        setAssignedProfiles(Array.isArray(data) ? data : []);
        return;
      }

      const { data, error } = await supabase
        .from("organisation_members")
        .select(
          "user_id, profiles:profiles(id, username, avatar_url, avatar_color)"
        )
        .eq("organisation_id", orgId);

      if (error) {
        console.error("loadOrgMembers error:", error);
        setAssignedProfiles([]);
        return;
      }

      const members = (data || []).map((row) => row.profiles).filter(Boolean);
      setAssignedProfiles(members);
    };

    loadProfiles();
  }, [user, isOrgMode, orgId]);

  // ===== FILTERS =====
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  };

  const getItemsByStatus = (status) =>
    tasks.filter((i) => i.status === status).filter(matchesSearch);

  const getProfileById = (uid) =>
    assignedProfiles.find((p) => p.id === uid) || null;

  const getPriorityClass = (p) =>
    p ? `priority-${p.toLowerCase()}` : "priority-medium";

  const formatDateRange = (start, end) => {
    const s = start || "";
    const e = end || "";
    if (!s && !e) return "-";
    if (s && e) return `${s} → ${e}`;
    return s ? `${s} → ?` : `? → ${e}`;
  };

  // ===== ACTIONS =====
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;

    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== taskId));

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      console.error("delete error:", error);
      setTasks(prev);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    const status = taskLocation.split(":")[1];

    const safePriority = newTask.priority || "Medium";
    const start_date = newTask.start_date ? newTask.start_date : null;
    const end_date = newTask.end_date ? newTask.end_date : null;

    if (start_date && end_date && end_date < start_date) {
      alert("End Date cannot be earlier than Start Date.");
      return;
    }

    const payload = {
      ...newTask,
      priority: safePriority,
      start_date,
      end_date,
      status,
      user_id: user.id,
    };

    if (isOrgMode) {
      payload.organisation_id = orgId;
      payload.is_main_board = true;

      if (!payload.assigned_to) {
        alert(
          "Please assign this task to someone so it appears on their Kanban board."
        );
        return;
      }
    } else {
      payload.organisation_id = null;
      payload.is_main_board = false;
    }

    const { error } = await supabase.from("tasks").insert([payload]);
    if (error) console.error("create error:", error);

    setShowNewTaskModal(false);
    setTaskLocation("status:todo");
    setNewTask({
      title: "",
      description: "",
      type: "",
      priority: "Medium",
      assigned_to: null,
      start_date: "",
      end_date: "",
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="workitems-container">
      {/* HEADER */}
      <div className="workitems-header">
        <div className="header-left">
          <div className="project-icon">
            {profile?.username?.charAt(0).toUpperCase() || "P"}
          </div>
          <div>
            <h1>
              {isOrgMode ? "Organisation Work Items" : "Personal Work Items"}
            </h1>
            <p>
              Logged in as: <strong>{profile?.username}</strong>
            </p>
          </div>
        </div>

        <div className="header-right">
          <div className="members">
            <ProfileAvatar profile={profile} />
          </div>
        </div>
      </div>




      {/* NAV */}
      <div className="workitems-nav">
        <div style={{ color: "#666", fontSize: 13 }}>
          {isOrgMode
            ? "Shared org backlog (all members)"
            : "Personal tasks + assigned tasks"}
        </div>

        <div className="nav-actions">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="btn-filter" type="button">
            <Tag size={14} />
            <span>Filter</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => setShowNewTaskModal(true)}
            type="button"
          >
            <Plus size={16} />
            New Task
          </button>
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="workitems-content">
        {["todo", "progress", "done"].map((status) => (
          <div key={status} className="section">
            <div
              className="section-header"
              onClick={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  [status]: !prev[status],
                }))
              }
            >
              <div className="section-title">
                {expandedSections[status] ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
                <h3>
                  {status === "todo"
                    ? "To Do"
                    : status === "progress"
                    ? "In Progress"
                    : "Done"}
                </h3>

                <span className="count">{getItemsByStatus(status).length}</span>
              </div>
            </div>

            {expandedSections[status] && (
              <div className="task-list">
                {getItemsByStatus(status).length === 0 ? (
                  <div className="empty-state">No tasks yet.</div>
                ) : (
                  <>
                    <div className="task-header">
                      <div className="col-arrow"></div>
                      <div className="col-task">Task</div>
                      <div className="col-description">Description</div>
                      <div className="col-estimation">Dates</div>
                      <div className="col-type">Type</div>
                      <div className="col-people">People</div>
                      <div className="col-priority">Priority</div>
                      <div className="col-actions"></div>
                    </div>

                    {getItemsByStatus(status).map((item) => {
                      const safeType =
                        typeof item.type === "string" && item.type.trim() !== ""
                          ? item.type
                          : "-";

                      const assignedProfile = item.assigned_to
                        ? getProfileById(item.assigned_to)
                        : null;

                      return (
                        <div key={item.id} className="task-row">
                          <div
                            className="col-arrow"
                            onClick={() => setSelectedTask(item)}
                          >
                            →
                          </div>

                          <div className="col-task" title={item.title || ""}>
                            {item.title}
                          </div>

                          <div
                            className="col-description"
                            title={item.description || ""}
                          >
                            {item.description || "-"}
                          </div>

                          <div className="col-estimation">
                            {formatDateRange(item.start_date, item.end_date)}
                          </div>

                          <div className="col-type">
                            <div
                              className="type-badge"
                              style={{
                                backgroundColor: getTypeColor(safeType) + "20",
                                color: getTypeColor(safeType),
                              }}
                            >
                              {safeType}
                            </div>
                          </div>

                          <div className="col-people">
                            <div className="readonly-box">
                              {assignedProfile
                                ? assignedProfile.username
                                : "Unassigned"}
                            </div>
                          </div>

                          <div className="col-priority">
                            <div
                              className={`priority-badge ${getPriorityClass(
                                item.priority
                              )} readonly-box`}
                            >
                              {item.priority || "Medium"}
                            </div>
                          </div>

                          <div className="col-actions">
                            <button
                              className="delete-dash"
                              onClick={() => handleDeleteTask(item.id)}
                              type="button"
                            >
                              –
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL — TASK DETAILS */}
      {selectedTask && (
        <div
          className="task-modal-overlay"
          onClick={() => setSelectedTask(null)}
        >
          <div className="task-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Task Details</h2>

            {/* ✅ WRAPS LONG TITLES (prevents side scroll) */}
            <p style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
              <strong>Title:</strong> {selectedTask.title}
            </p>

            <p>
              <strong>Description:</strong>
            </p>
            <div className="task-description-box">
              {selectedTask.description && selectedTask.description.trim()
                ? selectedTask.description
                : "None"}
            </div>

            <p style={{ marginTop: 12 }}>
              <strong>Dates:</strong>{" "}
              {formatDateRange(selectedTask.start_date, selectedTask.end_date)}
            </p>

            <p style={{ marginTop: 12 }}>
              <strong>AI Agent:</strong> {selectedTask.ai_agent || "None"}
            </p>

            <p>
              <strong>AI Output:</strong>
            </p>

            <textarea
              className="ai-output-box"
              readOnly
              value={(() => {
                const out = selectedTask.ai_output;
                if (out && String(out).trim()) return out;

                const hist = Array.isArray(selectedTask.ai_history)
                  ? selectedTask.ai_history
                  : [];
                const lastAssistant = [...hist]
                  .reverse()
                  .find((m) => m?.role === "assistant" && m?.content);

                return lastAssistant?.content || "No AI output.";
              })()}
            />

            <button
              className="btn-primary"
              onClick={() => setSelectedTask(null)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL — CREATE TASK */}
      {showNewTaskModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowNewTaskModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Task</h2>
              <button
                className="btn-icon"
                onClick={() => setShowNewTaskModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  value={newTask.title}
                  onChange={(e) =>
                    setNewTask({ ...newTask, title: e.target.value })
                  }
                  placeholder="Enter task title"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={newTask.start_date}
                    onChange={(e) =>
                      setNewTask({ ...newTask, start_date: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={newTask.end_date}
                    min={newTask.start_date || undefined}
                    onChange={(e) =>
                      setNewTask({ ...newTask, end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Placement</label>
                <select
                  value={taskLocation}
                  onChange={(e) => setTaskLocation(e.target.value)}
                >
                  <option value="status:todo">To-do</option>
                  <option value="status:progress">In Progress</option>
                  <option value="status:done">Done</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <input
                    type="text"
                    placeholder="Enter any task type"
                    value={newTask.type}
                    onChange={(e) =>
                      setNewTask({ ...newTask, type: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value })
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Assign to</label>
                <select
                  value={newTask.assigned_to ?? ""}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      assigned_to: e.target.value || null,
                    })
                  }
                >
                  <option value="" disabled hidden>
                    Unassigned
                  </option>
                  {assignedProfiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>

                {isOrgMode && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                    Only org members are shown here.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowNewTaskModal(false)}
                type="button"
              >
                Cancel
              </button>

              <button
                className="btn-primary"
                onClick={handleCreateTask}
                type="button"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
