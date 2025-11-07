import { useEffect, useState } from "react";
import { PostgrestError } from "@supabase/supabase-js";
import "./kanbanBoard.css";
import { supabase } from "../../lib/supabaseClient";

// ✅ Define task type based on your database
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "progress" | "done";
  hasAttachment?: boolean;
  hasComments?: boolean;
  hasSubtask?: boolean;
  subtaskProgress?: string;
}

const KanbanBoard = () => {
  const [tasks, setTasks] = useState<{
    todo: Task[];
    progress: Task[];
    done: Task[];
  }>({
    todo: [],
    progress: [],
    done: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // ✅ Fetch tasks from Supabase
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const { data, error }: { data: Task[] | null; error: PostgrestError | null } =
          await supabase.from("tasks").select("*");

        if (error) throw error;

        const grouped = {
          todo: data?.filter((t) => t.status === "todo") || [],
          progress: data?.filter((t) => t.status === "progress") || [],
          done: data?.filter((t) => t.status === "done") || [],
        };

        setTasks(grouped);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    // ✅ Real-time updates (safe cleanup)
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <div className="loading">Loading tasks...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  // ✅ Render Board
  return (
    <div className="kanban-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">
          <div className="logo-placeholder"></div>
        </div>

        <div className="tasks-section">
          <div className="tasks-header">
            <span>Tasks</span>
            <span className="task-count">
              {tasks.todo.length + tasks.progress.length + tasks.done.length}
            </span>
          </div>
        </div>

        <div className="main-section">
          <div className="main-label">MAIN</div>
          <div className="page-item">Page 1</div>
          <div className="page-item">Page 2</div>
          <div className="page-item">Page 3</div>
          <div className="page-item">Page 4</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <div className="welcome">Welcome Back</div>
          <div className="search-bar">
            <input type="text" placeholder="Search..." />
          </div>
          <div className="header-icons">
            <div className="icon-circle"></div>
            <div className="icon-circle"></div>
          </div>
        </div>

        {/* Board */}
        <div className="board">
          {/* ✅ To Do */}
          <KanbanColumn
            title="To Do"
            tasks={tasks.todo}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
          />

          {/* ✅ In Progress */}
          <KanbanColumn
            title="In Progress"
            tasks={tasks.progress}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
          />

          {/* ✅ Completed */}
          <KanbanColumn
            title="Completed"
            tasks={tasks.done}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
          />
        </div>
      </div>
    </div>
  );
};

// ✅ Reusable Column Component
const KanbanColumn = ({
  title,
  tasks,
  showMenu,
  setShowMenu,
}: {
  title: string;
  tasks: Task[];
  showMenu: string | null;
  setShowMenu: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
  return (
    <div className="column">
      <div className="column-header">
        <div className="column-title">{title}</div>
      </div>
      <div className="tasks-list">
        {tasks.map((task) => (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <div className="task-title-bar"></div>
              <button
                className="task-menu"
                onClick={() => setShowMenu(showMenu === task.id ? null : task.id)}
              >
                ⋮
              </button>
              {showMenu === task.id && (
                <div className="menu-dropdown">
                  <div className="menu-item">Edit</div>
                  <div className="menu-item">Delete</div>
                </div>
              )}
            </div>

            <div className="task-title">{task.title || "Untitled Task"}</div>
            <div className="task-description">{task.description || "No description"}</div>

            <div className="task-footer">
              <div className="task-icons">
                {task.hasAttachment && <span className="icon">📎</span>}
                {task.hasComments && <span className="icon">💬</span>}
              </div>
              <div className="task-actions">
                <button className="action-btn">+</button>
                <div className="avatar"></div>
              </div>
            </div>
          </div>
        ))}

        <button className="add-task-btn">
          Add Task <span className="plus-icon">+</span>
        </button>
      </div>
    </div>
  );
};

export default KanbanBoard;
