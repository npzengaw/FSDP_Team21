import "./KanbanBoard.css";
import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";

function KanbanBoard({ socket, tasks }) {
  const navigate = useNavigate();

  const [columns, setColumns] = useState({
    todo: [],
    progress: [],
    done: [],
  });

  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [copied, setCopied] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Format tasks into columns
  const updateBoard = (list) => {
    const safe = Array.isArray(list) ? list : [];
    setColumns({
      todo: safe.filter((t) => t.status === "todo"),
      progress: safe.filter((t) => t.status === "progress"),
      done: safe.filter((t) => t.status === "done"),
    });
  };

  useEffect(() => {
    if (tasks) updateBoard(tasks);
  }, [tasks]);

  // Add task
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    if (!socket) return;

    socket.emit("addTask", { title: newTaskTitle });
    setNewTaskTitle("");
    setShowAddPopup(false);
  };

  // Drag
  const onDragEnd = (result) => {
    if (!socket) return;
    if (!result.destination) return;

    const { source, destination } = result;
    const moved = columns[source.droppableId][source.index];
    if (!moved) return;

    const cols = { ...columns };
    cols[source.droppableId] = [...cols[source.droppableId]];
    cols[destination.droppableId] = [...cols[destination.droppableId]];

    cols[source.droppableId].splice(source.index, 1);
    cols[destination.droppableId].splice(destination.index, 0, {
      ...moved,
      status: destination.droppableId,
    });

    setColumns(cols);

    socket.emit("taskMoved", {
      taskId: moved.id,
      newStatus: destination.droppableId,
    });
  };

  // Edit title
  const startEditing = (task) => {
    if (task.status !== "todo") return;
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = (id) => {
    if (!socket) return;
    if (!editingTitle.trim()) return;

    socket.emit("renameTask", { taskId: id, newTitle: editingTitle });
    setEditingTaskId(null);
  };

  const deleteTask = (id) => {
    if (!socket) return;
    if (window.confirm("Delete task?")) {
      socket.emit("deleteTask", { taskId: id });
    }
  };

  const copyOutput = () => {
    if (!selectedTask?.ai_output) return;
    navigator.clipboard.writeText(selectedTask.ai_output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="kanban-container">
      <div className="main-content">
        {/* Header */}
        <div className="header" style={{ display: "flex", alignItems: "center" }}>
          {/* LEFT: title only */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="welcome">Personal Board</div>
          </div>

          {/* RIGHT: tabs */}
          <div style={{ marginLeft: "auto", display: "flex", gap: "16px" }}>
            <span style={{ cursor: "pointer", fontWeight: 600 }}>
              Kanban Board
            </span>

            <span
              style={{ cursor: "pointer", color: "#666" }}
              onClick={() => navigate("/workitems")}
            >
              WorkItems
            </span>
          </div>
        </div>

        {/* Kanban board */}
        <div className="board">
          <DragDropContext onDragEnd={onDragEnd}>
            {Object.entries(columns).map(([colId, list]) => (
              <Droppable droppableId={colId} key={colId}>
                {(provided) => (
                  <div
                    className={`column ${colId}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    <div className="column-header">
                      <div className="column-title">{colId.toUpperCase()}</div>
                      <div className="task-count">{list.length}</div>
                    </div>

                    <div className="tasks-list">
                      {list.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={String(task.id)}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (task.status === "done") setSelectedTask(task);
                              }}
                              onDoubleClick={() => startEditing(task)}
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

                              {editingTaskId === task.id ? (
                                <input
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={() => saveEdit(task.id)}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && saveEdit(task.id)
                                  }
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <div className="task-title">{task.title}</div>
                                  <div className="task-created-by">
                                    Created by:{" "}
                                    {task.profiles?.username || "Unknown"}
                                  </div>
                                </>
                              )}

                              <div className="task-description">
                                {task.status.toUpperCase()}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}

                      {colId === "todo" && (
                        <button
                          className="add-task-btn"
                          onClick={() => setShowAddPopup(true)}
                        >
                          Add Task <span className="plus-icon">+</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </DragDropContext>
        </div>
      </div>

      {/* AI Popup */}
      {selectedTask && (
        <div className="popup-overlay" onClick={() => setSelectedTask(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={() => setSelectedTask(null)}>
              ✕
            </button>

            <h2>{selectedTask.title}</h2>

            <div className="popup-content">
              {selectedTask.ai_output || "No AI output available"}
            </div>

            <div className="popup-footer">
              <button
                className={`copy-btn ${copied ? "copied" : ""}`}
                onClick={copyOutput}
              >
                {copied ? "Copied!" : "Copy Output"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Popup */}
      {showAddPopup && (
        <div className="popup-overlay" onClick={() => setShowAddPopup(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add Task</h3>

            <input
              placeholder="Enter task title..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            />

            <div className="popup-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowAddPopup(false)}
              >
                Cancel
              </button>

              <button className="add-btn" onClick={handleAddTask}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
