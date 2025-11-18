
/** FULL CLEAN VERSION OF WORKITEMS.JS — NO COLUMN LOGIC **/
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Search,
  Tag,
} from "lucide-react";
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
  const { orgId } = useParams();
  const navigate = useNavigate();

  const [orgInfo, setOrgInfo] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    progress: true,
    done: true,
  });
  const [loading, setLoading] = useState(true);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [isPersonalBoard, setIsPersonalBoard] = useState(false);
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

  /* ----------------------- LOAD ORG ----------------------- */
  useEffect(() => {
    if (!orgId) return;

    const loadOrgInfo = async () => {
      const { data } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", orgId)
        .single();

      setOrgInfo(data);
    };

    loadOrgInfo();
  }, [orgId]);

  /* ----------------------- LOAD PROFILES ----------------------- */
  useEffect(() => {
    if (!orgId) return;

    const fetchProfiles = async () => {
      const { data: members } = await supabase
        .from("organisation_members")
        .select(`
          user_id,
          profiles (
            id,
            username,
            avatar_url,
            avatar_colour
          )
        `)
        .eq("organisation_id", orgId);

      const safe = Array.isArray(members) ? members : [];
      setProfiles(
        safe
          .map((m) => m.profiles)
          .filter((p) => p !== null && p !== undefined)
      );
    };

    fetchProfiles();
  }, [orgId]);

  /* ----------------------- LOAD TASKS + REALTIME ----------------------- */
  useEffect(() => {
    if (!orgId || !user) return;

    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false });

      setTasks(data || []);
      setLoading(false);
    };

    fetchTasks();

    const channel = supabase
      .channel(`tasks_${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        fetchTasks
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [orgId, user]);

  /* ----------------------- FILTERS ----------------------- */

  const filteredTasks = tasks.filter((t) => {
    if (isPersonalBoard) return t.user_id === user.id && !t.is_main_board;
    return t.is_main_board;
  });

  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  };

  const getItemsByStatus = (status) =>
    filteredTasks
      .filter((i) => i.status === status)
      .filter(matchesSearch);

  const getProfileById = (uid) =>
    profiles.find((p) => p.id === uid) || null;

  const getPriorityClass = (p) =>
    p ? `priority-${p.toLowerCase()}` : "priority-medium";

  /* ----------------------- CREATE TASK ----------------------- */

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    let status = taskLocation.split(":")[1];

    await supabase.from("tasks").insert([
      {
        ...newTask,
        status,
        organisation_id: orgId,
        user_id: user.id,
        is_main_board: !isPersonalBoard,
      },
    ]);

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
            {orgInfo?.name?.charAt(0).toUpperCase() || "W"}
          </div>
          <div>
            <h1>{orgInfo?.name}</h1>
            <p>
              Logged in as: <strong>{profile?.username}</strong>
            </p>
          </div>
        </div>

        <div className="header-right">
          <div className="members">
            {profiles.slice(0, 5).map((p) => (
              <ProfileAvatar key={p.id} profile={p} />
            ))}

            {profiles.length > 5 && (
              <div className="profile-avatar" style={{ background: "#999" }}>
                +{profiles.length - 5}
              </div>
            )}
          </div>

          <button
            className="btn-invite"
            onClick={() => navigate("/organisations")}
          >
            ← Back
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="top-tabs">
        <button onClick={() => navigate(`/org/${orgId}`)} className="top-tab">
          Kanban Board
        </button>
        <button className="top-tab active">Work Items</button>
      </div>

      {/* NAV */}
      <div className="workitems-nav">
        <div className="board-toggle">
          <button
            onClick={() => setIsPersonalBoard(true)}
            className={`board-pill ${isPersonalBoard ? "active" : ""}`}
          >
            My Board
          </button>

          <button
            onClick={() => setIsPersonalBoard(false)}
            className={`board-pill ${!isPersonalBoard ? "active" : ""}`}
          >
            Main Board
          </button>
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

          <button className="btn-filter">
            <Tag size={14} />
            <span>Filter</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => setShowNewTaskModal(true)}
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

                <span className="count">
                  {getItemsByStatus(status).length}
                </span>
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
                        typeof item.type === "string" &&
                        item.type.trim() !== ""
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
                                backgroundColor:
                                  getTypeColor(safeType) + "20",
                                color: getTypeColor(safeType),
                              }}
                            >
                              {safeType}
                            </div>
                          </div>

                          <div className="col-people">
                            {item.assigned_to &&
                            getProfileById(item.assigned_to) ? (
                              <ProfileAvatar
                                profile={getProfileById(item.assigned_to)}
                              />
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

            <button
              className="btn-primary"
              onClick={() => setSelectedTask(null)}
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

              {/* simplified placement */}
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
                  value={newTask.assigned_to || ""}
                  onChange={(e) =>
                    setNewTask({
                      ...newTask,
                      assigned_to: e.target.value || null,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {profiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowNewTaskModal(false)}
              >
                Cancel
              </button>

              <button className="btn-primary" onClick={handleCreateTask}>
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
