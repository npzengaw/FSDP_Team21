import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";



interface Task {
  id: string;
  title: string;
  description?: string;
  estimate?: string;
  type?: string;
  assigned_to?: string;
  priority?: string;
  status: string;
  visibility?: boolean;
  created_at?: string;
}

type Status = "todo" | "progress" | "done";

interface ExpandedSections {
  [key: string]: boolean;
}

const colors = ["#f87171", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa"];

function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    todo: true,
    progress: true,
    done: true,
  });

  // ✅ Fetch all tasks and subscribe to real-time updates
  useEffect(() => {
    fetchTasks();

    const subscription = supabase
      .channel("public:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          console.log("📡 Database change:", payload);
          fetchTasks();
        }
      )
      .subscribe((status) => {
        console.log("🟢 Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // ✅ Fixed: Safer Supabase fetch function
  async function fetchTasks() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!data) {
        console.warn("⚠️ No tasks found in database.");
        setTasks([]);
        return;
      }

      // Normalize statuses to lowercase (so DB values like “Progress” still work)
      const normalizedData = data.map((t: any) => ({
        ...t,
        status: t.status?.toLowerCase() || "todo",
      }));

      console.log("✅ Tasks fetched:", normalizedData);
      setTasks(normalizedData);
    } catch (err: any) {
      console.error("❌ Error fetching tasks:", err);
      setError(err.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }

  const statusGroups: Status[] = ["todo", "progress", "done"];

  const getInitials = (name: string) => (name ? name[0].toUpperCase() : "?");
  const getAvatarColor = (name: string) =>
    colors[name?.charCodeAt(0) % colors.length] || "#60a5fa";

  const toggleSection = (status: Status) => {
    setExpandedSections((prev) => ({
      ...prev,
      [status]: !prev[status],
    }));
  };

  const getStatusLabel = (status: Status) => {
    const labels: Record<Status, string> = {
      todo: "To Do",
      progress: "In Progress",
      done: "Completed",
    };
    return labels[status];
  };

  const getTaskCount = (status: Status) =>
    tasks.filter((t) => t.status === status).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold mb-2">
            Error loading tasks
          </h3>
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-36 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-4">
          <button className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded flex items-center justify-between">
            Tasks
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 mt-8">
          <div className="text-xs font-semibold text-gray-400 mb-2">PAGES</div>
          <div className="space-y-1">
            {["Page 1", "Page 2", "Page 3", "Page 4"].map((page) => (
              <div
                key={page}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded cursor-pointer"
              >
                {page}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">Welcome Back</span>
            <div className="w-80 bg-gray-100 rounded-md px-3 py-1.5">
              <input
                type="text"
                placeholder="Search"
                className="w-full bg-transparent text-sm text-gray-600 outline-none placeholder-gray-400"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          </div>
        </div>

        {/* Work Items */}
        <div className="flex-1 overflow-auto p-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">
            Work Items
          </h1>

          <div className="space-y-2">
            {statusGroups.map((status) => {
              const taskCount = getTaskCount(status);
              const isExpanded = expandedSections[status];
              const statusTasks = tasks.filter((t) => t.status === status);

              return (
                <div
                  key={status}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(status)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="font-medium text-gray-900">
                        {getStatusLabel(status)}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                        {taskCount}
                      </span>
                    </div>
                    <Plus className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  </button>

                  {/* Task Table */}
                  {isExpanded && taskCount > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-t border-b border-gray-200">
                          <tr>
                            <th className="w-12 px-4 py-2"></th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Task Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Description
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Estimation
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Type
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              People
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              Priority
                            </th>
                            <th className="w-12 px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {statusTasks.map((task) => (
                            <tr
                              key={task.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="radio"
                                  name={`task-${status}`}
                                  checked={task.visibility ?? false}
                                  readOnly
                                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">
                                  {task.title}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {task.description || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {task.estimate || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {task.type || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex -space-x-1">
                                  {task.assigned_to
                                    ?.split(",")
                                    .map((person, idx) => (
                                      <div
                                        key={idx}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                                        style={{
                                          backgroundColor: getAvatarColor(
                                            person.trim()
                                          ),
                                        }}
                                        title={person.trim()}
                                      >
                                        {getInitials(person.trim())}
                                      </div>
                                    ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {task.priority || "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isExpanded && taskCount === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">
                      No tasks in {getStatusLabel(status).toLowerCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="mt-6 flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <span>Add new column</span>
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default KanbanBoard;
