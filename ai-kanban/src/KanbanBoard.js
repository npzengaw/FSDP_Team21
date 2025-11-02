import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  withCredentials: true,
  transports: ["websocket", "polling"]
});

function KanbanBoard() {
  const [columns, setColumns] = useState({
    todo: [],
    progress: [],
    done: []
  });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState(null); // 👈 popup state
  const [copied, setCopied] = useState(false); // 👈 copy feedback

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
    socket.emit("addTask", { id: Date.now().toString(), title: newTaskTitle });
    setNewTaskTitle("");
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const movedTask = columns[source.droppableId][source.index];
    socket.emit("taskMoved", {
      taskId: movedTask.id,
      newStatus: destination.droppableId
    });
  };

  const copyOutput = () => {
    if (selectedTask && selectedTask.ai_output) {
      navigator.clipboard.writeText(selectedTask.ai_output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
                  <h3 style={{ textAlign: "center" }}>
                    {colId.toUpperCase()}
                  </h3>
                  {tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => setSelectedTask(task)} // 👈 click opens popup
                          style={{
                            padding: "10px",
                            margin: "5px 0",
                            background: "#fff",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border: "1px solid #ddd",
                            ...provided.draggableProps.style,
                          }}
                        >
                          {task.title}
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

      {/* 👇 Popup modal */}
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
