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
    socket.emit("taskMoved", { taskId: movedTask.id, newStatus: destination.droppableId });
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
                <div ref={provided.innerRef} {...provided.droppableProps} style={{ padding: "10px", background: "#eee", minHeight: "300px" }}>
                  <h3>{colId.toUpperCase()}</h3>
                  {tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            padding: "10px",
                            margin: "5px",
                            background: "#fff",
                            borderRadius: "4px",
                            ...provided.draggableProps.style
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
    </div>
  );
}

export default KanbanBoard;
