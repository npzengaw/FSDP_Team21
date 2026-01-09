import "./KanbanBoard.css";
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";

function KanbanBoard({ socket, tasks }) {
  const navigate = useNavigate();
  const chatRef = useRef(null);
  const [columns, setColumns] = useState({
    todo: [],
    progress: [],
    done: [],
  });

  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [aiInput, setAiInput] = useState("");
useEffect(() => {
  if (chatRef.current) {
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }
}, [selectedTask?.ai_history, selectedTask?.ai_status]);

  // Update columns when tasks change
  useEffect(() => {
    const safe = Array.isArray(tasks) ? tasks : [];
    setColumns({
      todo: safe.filter((t) => t.status === "todo"),
      progress: safe.filter((t) => t.status === "progress"),
      done: safe.filter((t) => t.status === "done"),
    });
  }, [tasks]);

  // Update selectedTask if it changes in tasks
  useEffect(() => {
    if (!selectedTask || !tasks) return;
    const updated = tasks.find((t) => t.id === selectedTask.id);
    if (updated) setSelectedTask(updated);
  }, [tasks, selectedTask]);

  // Add task
  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !socket) return;
    socket.emit("addTask", { title: newTaskTitle });
    setNewTaskTitle("");
    setShowAddPopup(false);
  };

  // Drag and drop
  const onDragEnd = (result) => {
    if (!socket || !result.destination) return;
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
    if (!socket || !editingTitle.trim()) return;
    socket.emit("renameTask", { taskId: id, newTitle: editingTitle });
    setEditingTaskId(null);
  };

  const deleteTask = (id) => {
    if (!socket) return;
    if (window.confirm("Delete task?")) socket.emit("deleteTask", { taskId: id });
  };

  // Send AI prompt
  const sendPrompt = () => {
    if (!aiInput.trim() || !socket || !selectedTask) return;
    socket.emit("aiPrompt", { taskId: selectedTask.id, prompt: aiInput });
    setAiInput("");
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

                      {colId === "todo" && (
                      <button
                        className="add-task-btn"
                        onClick={() => setShowAddPopup(true)}
                      >
                        Add Task <span className="plus-icon">+</span>
                      </button>
                    )}

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
                                if (task.status !== "todo") setSelectedTask(task);
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

                              <div className={`ai-status ${task.ai_status}`}>
                                {task.ai_status || "idle"}
                              </div>

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

      {/* AI Popup */}
{selectedTask && (
  <div className="popup-overlay" onClick={() => setSelectedTask(null)}>
    <div className="popup-card large" onClick={(e) => e.stopPropagation()}>
      <button className="popup-close" onClick={() => setSelectedTask(null)}>
        ✕
      </button>

      <h2>{selectedTask.title}</h2>

<div className="popup-content chat-window" ref={chatRef}>
  {(selectedTask.ai_history || []).map((msg, index) => (
    <div
    key={index}
    className={`chat-bubble ${msg.role === "assistant" ? "assistant" : "user"}`}
  >
    {/* Use ReactMarkdown to render the text properly */}
    <ReactMarkdown>{msg.content}</ReactMarkdown>
  </div>
  ))}

  {selectedTask.ai_status === "thinking" && (
    <div className="chat-bubble assistant typing">
      AI is thinking...
    </div>
  )}
</div>


      <div className="popup-footer">
        <input
          className="ai-input"
          placeholder="Send instructions to AI..."
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendPrompt()}
        />
        <button className="send-btn" onClick={sendPrompt}>
          Send
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
