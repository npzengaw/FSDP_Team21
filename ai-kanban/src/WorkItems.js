/** PERSONAL-ONLY WORKITEMS.JS (NO ORG, NO MAIN BOARD) **/
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, X, Search, Tag } from "lucide-react";
import { supabase } from "./supabaseClient";
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
  const index = userId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
};

const ProfileAvatar = ({ profile }) => {
  if (!profile) return null;

  const initial = profile.username?.charAt(0).toUpperCase() || "?";
  const bgColor = profile.avatar_colour || getAvatarColor(profile.id);

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

  const hash = safe
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return TYPE_COLORS[hash % TYPE_COLORS.length];
};

/* ----------------------- MAIN ----------------------- */
const WorkItems = ({ user, profile }) => {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [assignedProfiles, setAssignedProfiles] = useState([]); // profiles for assigned_to dropdown
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
    estimation: "",
  });

  /* ----------------------- AUTH GUARD ----------------------- */
  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  /* ----------------------- LOAD TASKS + REALTIME (PERSONAL ONLY) ----------------------- */
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("fetchTasks error:", error);

      setTasks(data || []);
      setLoading(false);
    };

    fetchTasks();

    // Realtime: listen only to changes that affect THIS user's tasks
    const channel = supabase
      .channel(`tasks_personal_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${user.id}`,
        },
        fetchTasks
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  /* ----------------------- LOAD ASSIGNEE PROFILES (OPTIONAL) -----------------------
     If you still want "Assign to" dropdown, we can load all profiles.
     If you only want self-assignment, you can remove this block.
  */
  useEffect(() => {
    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, avatar_colour");

      if (error) console.error("loadProfiles error:", error);
      setAssignedProfiles(Array.isArray(data) ? data : []);
    };

    loadProfiles();
  }, []);

  /* ----------------------- FILTERS ----------------------- */
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

  /* ----------------------- ACTIONS ----------------------- */
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) console.error("delete error:", error);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    const status = taskLocation.split(":")[1];

    const payload = {
      ...newTask,
      status,
      user_id: user.id, // PERSONAL ONLY
    };

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
      estimation: "",
    });
  };

  /* ----------------------- RENDER ----------------------- */
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
            <h1>Personal Work Items</h1>
            <p>
              Logged in as: <strong>{profile?.username}</strong>
            </p>
          </div>
        </div>

        <div className="header-right">
          {/* Show your own avatar */}
          <div className="members">
            <ProfileAvatar profile={profile} />
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="top-tabs">
        <button onClick={() => navigate("/kanban")} className="top-tab">
          Kanban Board
        </button>
        <button className="top-tab active">Work Items</button>
      </div>

      {/* NAV */}
      <div className="workitems-nav">
        <div style={{ color: "#666", fontSize: 13 }}>
          Personal tasks only
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
                    : "Completed"}
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
                    {/* HEADER */}
                    <div className="task-header">
                      <div className="col-task">Task</div>
                      <div className="col-description">Description</div>
                      <div className="col-estimation">Estimation</div>
                      <div className="col-type">Type</div>
                      <div className="col-people">People</div>
                      <div className="col-priority">Priority</div>
                      <div className="col-actions"></div>
                    </div>

                    {/* TASK ROWS */}
                    {getItemsByStatus(status).map((item) => {
                      const safeType =
                        typeof item.type === "string" && item.type.trim() !== ""
                          ? item.type
                          : "-";

                      return (
                        <div key={item.id} className="task-row">
                          <div
                            className="col-arrow"
                            onClick={() => setSelectedTask(item)}
                          >
                            →
                          </div>

                          <div className="col-task">{item.title}</div>
                          <div className="col-description">
                            {item.description || "-"}
                          </div>
                          <div className="col-estimation">
                            {item.estimation || "-"}
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
                            {item.assigned_to && getProfileById(item.assigned_to) ? (
                              <ProfileAvatar profile={getProfileById(item.assigned_to)} />
                            ) : (
                              <span style={{ color: "#999", fontSize: 12 }}>
                                Unassigned
                              </span>
                            )}
                          </div>

                          <div className="col-priority">
                            <span
                              className={`priority-badge ${getPriorityClass(
                                item.priority
                              )}`}
                            >
                              {item.priority || "Medium"}
                            </span>
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

            <p>
              <strong>Title:</strong> {selectedTask.title}
            </p>

            <p>
              <strong>AI Agent:</strong> {selectedTask.ai_agent || "None"}
            </p>

            <p>
              <strong>AI Output:</strong>
            </p>

            <pre className="ai-output-box">
              {selectedTask.ai_output || "No AI output."}
            </pre>

            <button className="btn-primary" onClick={() => setSelectedTask(null)} type="button">
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL — CREATE TASK */}
      {showNewTaskModal && (
        <div className="modal-overlay" onClick={() => setShowNewTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Task</h2>
              <button className="btn-icon" onClick={() => setShowNewTaskModal(false)} type="button">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
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

              <div className="form-group">
                <label>Estimation</label>
                <input
                  value={newTask.estimation}
                  onChange={(e) =>
                    setNewTask({ ...newTask, estimation: e.target.value })
                  }
                  placeholder="Enter estimation"
                />
              </div>

              {/* placement */}
              <div className="form-group">
                <label>Placement</label>
                <select
                  value={taskLocation}
                  onChange={(e) => setTaskLocation(e.target.value)}
                >
                  <option value="status:todo">To-do</option>
                  <option value="status:progress">In Progress</option>
                  <option value="status:done">Completed</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <input
                    type="text"
                    placeholder="Enter any task type"
                    value={newTask.type}
                    onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
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
                  value={newTask.assigned_to || ""}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      assigned_to: e.target.value || null,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {assignedProfiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowNewTaskModal(false)} type="button">
                Cancel
              </button>

              <button className="btn-primary" onClick={handleCreateTask} type="button">
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkItems;
