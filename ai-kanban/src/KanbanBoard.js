import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

function KanbanBoard() {
  const [columns, setColumns] = useState({
    todo: [],
    progress: [],
    done: [],
  });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    socket.on("loadTasks", updateColumns);
    socket.on("updateTasks", updateColumns);

    return () => {
      socket.off("loadTasks");
      socket.off("updateTasks");
    };
  }, []);

  const updateColumns = (tasks) => {
    setColumns({
      todo: tasks.filter((task) => task.status === "todo"),
      progress: tasks.filter((task) => task.status === "progress"),
      done: tasks.filter((task) => task.status === "done"),
    });
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    socket.emit("addTask", { title: newTaskTitle }); // let Supabase assign the ID
    setNewTaskTitle("");
  };


  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;
    if (sourceCol === destCol) return;

    const movedTask = columns[sourceCol][source.index];
    const updatedCols = { ...columns };
    updatedCols[sourceCol].splice(source.index, 1);
    updatedCols[destCol].splice(destination.index, 0, {
      ...movedTask,
      status: destCol,
    });
    setColumns(updatedCols);

    setTimeout(() => {
      socket.emit("taskMoved", {
        taskId: movedTask.id,
        newStatus: destCol,
      });
    }, 400);
  };

  const copyOutput = () => {
    if (selectedTask && selectedTask.ai_output) {
      navigator.clipboard.writeText(selectedTask.ai_output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleTaskClick = (task) => {
    if (task.status === "done") setSelectedTask(task);
  };

  const startEditing = (task) => {
    if (task.status !== "todo") return; // 🔒 Only edit todo tasks
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = (taskId) => {
    if (!editingTitle.trim()) {
      setEditingTaskId(null);
      return;
    }
    socket.emit("renameTask", { taskId, newTitle: editingTitle });
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const deleteTask = (taskId) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      socket.emit("deleteTask", { taskId });
    }
  };

  return (
    <div>
      <h2 style={{ textAlign: "center" }}>AI Kanban Board</h2>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Enter new task"
        />
        <button onClick={addTask}>Add Task</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          {Object.entries(columns).map(([colId, tasks]) => (
            <Droppable droppableId={colId} key={colId}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    padding: "10px",
                    background: "#eee",
                    minHeight: "300px",
                    width: "250px",
                    borderRadius: "6px",
                  }}
                >
                  <h3 style={{ textAlign: "center" }}>{colId.toUpperCase()}</h3>

                  {tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => handleTaskClick(task)}
                          onDoubleClick={() => startEditing(task)}
                          style={{
                            padding: "10px",
                            margin: "5px 0",
                            background:
                              task.status === "done"
                                ? "#e7f8ec"
                                : task.status === "progress"
                                ? "#fffbe6"
                                : "#fff",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                            position: "relative",
                            cursor:
                              task.status === "done"
                                ? "pointer"
                                : task.status === "todo"
                                ? "text"
                                : "default",
                            transition: "0.2s",
                            ...provided.draggableProps.style,
                          }}
                        >
                          {/* ✅ Inline rename only for To-Do tasks */}
                          {editingTaskId === task.id && task.status === "todo" ? (
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => saveEdit(task.id)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && saveEdit(task.id)
                              }
                              autoFocus
                              style={{
                                width: "100%",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                padding: "5px",
                              }}
                            />
                          ) : (
                            <strong>{task.title}</strong>
                          )}

                          <p
                            style={{
                              fontSize: "12px",
                              color: "#555",
                              margin: "2px 0 0",
                            }}
                          >
                            {task.status.toUpperCase()}
                          </p>

                          {/* 🗑️ Delete button (all statuses) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask(task.id);
                            }}
                            style={{
                              position: "absolute",
                              top: "5px",
                              right: "5px",
                              border: "none",
                              background: "none",
                              color: "#999",
                              cursor: "pointer",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* ✅ Popup modal for done tasks */}
      {selectedTask && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedTask(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "90%",
              position: "relative",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            <button
              onClick={() => setSelectedTask(null)}
              style={{
                position: "absolute",
                top: "8px",
                right: "10px",
                border: "none",
                background: "none",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <h2>{selectedTask.title}</h2>
            <p>
              <strong>Status:</strong> {selectedTask.status}
            </p>
            <p>
              <strong>AI Agent:</strong>{" "}
              {selectedTask.ai_agent || "Unknown"}
            </p>

            <div
              style={{
                marginTop: "10px",
                background: "#f7f7f7",
                padding: "10px",
                borderRadius: "6px",
                maxHeight: "250px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedTask.ai_output || "No AI output available."}
            </div>

            <div style={{ marginTop: "10px", textAlign: "right" }}>
              <button
                onClick={copyOutput}
                style={{
                  background: copied ? "#4caf50" : "#007bff",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {copied ? "Copied!" : "Copy Output"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
