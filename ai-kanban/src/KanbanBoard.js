// import "./KanbanBoard.css";
// import React, { useState, useEffect } from "react";
// import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// function KanbanBoard({ socket, tasks, user }) {
//   const [columns, setColumns] = useState({
//     todo: [],
//     progress: [],
//     done: [],
//   });

//   const [board, setBoard] = useState("personal"); // "personal" | "main"

//   const [showAddPopup, setShowAddPopup] = useState(false);
//   const [newTaskTitle, setNewTaskTitle] = useState("");

//   const [selectedTask, setSelectedTask] = useState(null);
//   const [copied, setCopied] = useState(false);

//   const [editingTaskId, setEditingTaskId] = useState(null);
//   const [editingTitle, setEditingTitle] = useState("");

//   // Helper to update UI columns
//   const updateBoard = (list) => {
//     const safeList = Array.isArray(list) ? list : [];
//     setColumns({
//       todo: safeList.filter((t) => t.status === "todo"),
//       progress: safeList.filter((t) => t.status === "progress"),
//       done: safeList.filter((t) => t.status === "done"),
//     });
//   };

//   // ============================================================
//   // 🔵 Sync incoming tasks (from OrgBoardPage socket handlers)
//   // ============================================================
//   useEffect(() => {
//     if (tasks) {
//       console.log("[KanbanBoard] tasks prop changed:", tasks);
//       updateBoard(tasks);
//     }
//   }, [tasks]);

//   // ============================================================
//   // 🔷 ADD TASK
//   // ============================================================
//   const handleAddTask = () => {
//     if (!newTaskTitle.trim()) return alert("Please enter a task title!");
//     if (!socket) return alert("Not connected to server.");

//     socket.emit("addTask", { title: newTaskTitle });

//     setNewTaskTitle("");
//     setShowAddPopup(false);
//   };

//   // ============================================================
//   // 🔶 DRAG AND DROP
//   // ============================================================
//   const onDragEnd = (result) => {
//     if (!socket) return;

//     const { source, destination } = result;
//     if (!destination) return;

//     const sourceCol = source.droppableId;
//     const destCol = destination.droppableId;

//     if (sourceCol === destCol) return;

//     const movedTask = columns[sourceCol][source.index];
//     if (!movedTask) return;

//     // Update UI instantly
//     const updatedCols = { ...columns };
//     updatedCols[sourceCol] = Array.from(updatedCols[sourceCol]);
//     updatedCols[destCol] = Array.from(updatedCols[destCol]);

//     updatedCols[sourceCol].splice(source.index, 1);
//     updatedCols[destCol].splice(destination.index, 0, {
//       ...movedTask,
//       status: destCol,
//     });
//     setColumns(updatedCols);

//     // Tell server
//     socket.emit("taskMoved", {
//       taskId: movedTask.id,
//       newStatus: destCol,
//     });
//   };

//   // ============================================================
//   // 🟣 RENAME TASK
//   // ============================================================
//   const startEditing = (task) => {
//     if (task.status !== "todo") return;
//     setEditingTaskId(task.id);
//     setEditingTitle(task.title);
//   };

//   const saveEdit = (taskId) => {
//     if (!socket) return;
//     if (!editingTitle.trim()) {
//       setEditingTaskId(null);
//       return;
//     }

//     socket.emit("renameTask", { taskId, newTitle: editingTitle });

//     setEditingTaskId(null);
//     setEditingTitle("");
//   };

//   // ============================================================
//   // 🔴 DELETE TASK
//   // ============================================================
//   const deleteTask = (taskId) => {
//     if (!socket) return;
//     if (window.confirm("Delete this task?")) {
//       socket.emit("deleteTask", { taskId });
//     }
//   };

//   // ============================================================
//   // 🟢 AI POPUP OUTPUT COPY
//   // ============================================================
//   const copyOutput = () => {
//     if (selectedTask?.ai_output) {
//       navigator.clipboard.writeText(selectedTask.ai_output);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 1500);
//     }
//   };

//   const handleTaskClick = (task) => {
//     if (task.status === "done") setSelectedTask(task);
//   };

//   // ============================================================
//   // BOARD SWITCH HANDLERS
//   // ============================================================
//   const switchToBoard = (targetBoard) => {
//     if (!socket) return;
//     if (board === targetBoard) return;

//     setBoard(targetBoard);
//     socket.emit("switchBoard", { board: targetBoard });
//   };

//   // ============================================================
//   // UI RENDER
//   // ============================================================
//   return (
//     <div className="kanban-container">
//       <div className="main-content">
//         <div className="header">
//           <div className="welcome">
//             {board === "personal" ? "Your Tasks" : "Team Tasks"}
//           </div>
//         </div>

//         <div className="board-switch">
//           <button
//             className={board === "personal" ? "active" : ""}
//             onClick={() => switchToBoard("personal")}
//           >
//             My Board
//           </button>

//           <button
//             className={board === "main" ? "active" : ""}
//             onClick={() => switchToBoard("main")}
//           >
//             Main Board
//           </button>
//         </div>

//         <div className="board">
//           <DragDropContext onDragEnd={onDragEnd}>
//             {Object.entries(columns).map(([colId, list]) => (
//               <Droppable droppableId={colId} key={colId}>
//                 {(provided) => (
//                   <div
//                     ref={provided.innerRef}
//                     {...provided.droppableProps}
//                     className="column"
//                   >
//                     <div className="column-header">
//                       <div className="column-title">{colId.toUpperCase()}</div>
//                     </div>

//                     <div className="tasks-list">
//                       {list.map((task, index) => (
//                         <Draggable
//                           key={task.id}
//                           draggableId={String(task.id)}
//                           index={index}
//                         >
//                           {(provided) => (
//                             <div
//                               ref={provided.innerRef}
//                               {...provided.draggableProps}
//                               {...provided.dragHandleProps}
//                               className="task-card"
//                               onClick={() => handleTaskClick(task)}
//                               onDoubleClick={() => startEditing(task)}
//                             >
//                               <div className="task-header">
//                                 <div className="task-title-bar"></div>
//                                 <button
//                                   className="task-menu"
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     deleteTask(task.id);
//                                   }}
//                                 >
//                                   ✕
//                                 </button>
//                               </div>

//                               {editingTaskId === task.id ? (
//                                 <input
//                                   value={editingTitle}
//                                   onChange={(e) =>
//                                     setEditingTitle(e.target.value)
//                                   }
//                                   onBlur={() => saveEdit(task.id)}
//                                   onKeyDown={(e) =>
//                                     e.key === "Enter" && saveEdit(task.id)
//                                   }
//                                   autoFocus
//                                 />
//                               ) : (
//                                 <>
//                                   <div className="task-title">
//                                     {task.title}
//                                   </div>

//                                   <div className="task-created-by">
//                                     Created by:{" "}
//                                     {task.profiles?.username || "Unknown"}
//                                   </div>
//                                 </>
//                               )}

//                               <div className="task-description">
//                                 {task.status.toUpperCase()}
//                               </div>
//                             </div>
//                           )}
//                         </Draggable>
//                       ))}

//                       {provided.placeholder}

//                       {colId === "todo" && (
//                         <button
//                           className="add-task-btn"
//                           onClick={() => setShowAddPopup(true)}
//                         >
//                           Add Task <span className="plus-icon">+</span>
//                         </button>
//                       )}
//                     </div>
//                   </div>
//                 )}
//               </Droppable>
//             ))}
//           </DragDropContext>
//         </div>
//       </div>

//       {/* ====================== AI POPUP ====================== */}
//       {selectedTask && (
//         <div
//           className="popup-overlay"
//           onClick={() => setSelectedTask(null)}
//         >
//           <div
//             className="popup-card"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <button
//               className="popup-close"
//               onClick={() => setSelectedTask(null)}
//             >
//               ✕
//             </button>
//             <h2>{selectedTask.title}</h2>
//             <p>
//               <strong>Status:</strong> {selectedTask.status}
//             </p>

//             <div className="popup-content">
//               {selectedTask.ai_output || "No AI output available."}
//             </div>

//             <div className="popup-footer">
//               <button
//                 className={copy-btn ${copied ? "copied" : ""}}
//                 onClick={copyOutput}
//               >
//                 {copied ? "Copied!" : "Copy Output"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ====================== ADD TASK POPUP ====================== */}
//       {showAddPopup && (
//         <div
//           className="popup-overlay"
//           onClick={() => setShowAddPopup(false)}
//         >
//           <div
//             className="popup-card"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <h3>Add New Task</h3>
//             <input
//               type="text"
//               placeholder="Enter task title..."
//               value={newTaskTitle}
//               onChange={(e) => setNewTaskTitle(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
//             />

//             <div className="popup-actions">
//               <button
//                 className="cancel-btn"
//                 onClick={() => setShowAddPopup(false)}
//               >
//                 Cancel
//               </button>
//               <button className="add-btn" onClick={handleAddTask}>
//                 Add
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default KanbanBoard;

import "./KanbanBoard.css";
import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Sidebar from "./Sidebar";

function KanbanBoard({ socket, tasks, user }) {
  const [columns, setColumns] = useState({
    todo: [],
    progress: [],
    done: [],
  });

  const [board, setBoard] = useState("personal");

  const [showAddPopup, setShowAddPopup] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [copied, setCopied] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const updateBoard = (list) => {
    const safeList = Array.isArray(list) ? list : [];
    setColumns({
      todo: safeList.filter((t) => t.status === "todo"),
      progress: safeList.filter((t) => t.status === "progress"),
      done: safeList.filter((t) => t.status === "done"),
    });
  };

  useEffect(() => {
    if (tasks) updateBoard(tasks);
  }, [tasks]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return alert("Please enter a task title!");
    if (!socket) return alert("Not connected to server.");

    socket.emit("addTask", { title: newTaskTitle });

    setNewTaskTitle("");
    setShowAddPopup(false);
  };

  const onDragEnd = (result) => {
    if (!socket) return;

    const { source, destination } = result;
    if (!destination) return;

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    if (sourceCol === destCol) return;

    const movedTask = columns[sourceCol][source.index];
    if (!movedTask) return;

    const updatedCols = { ...columns };
    updatedCols[sourceCol] = [...updatedCols[sourceCol]];
    updatedCols[destCol] = [...updatedCols[destCol]];

    updatedCols[sourceCol].splice(source.index, 1);
    updatedCols[destCol].splice(destination.index, 0, {
      ...movedTask,
      status: destCol,
    });

    setColumns(updatedCols);

    socket.emit("taskMoved", {
      taskId: movedTask.id,
      newStatus: destCol,
    });
  };

  const startEditing = (task) => {
    if (task.status !== "todo") return;
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = (taskId) => {
    if (!socket) return;

    if (!editingTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    socket.emit("renameTask", { taskId, newTitle: editingTitle });

    setEditingTaskId(null);
    setEditingTitle("");
  };

  const deleteTask = (taskId) => {
    if (!socket) return;
    if (window.confirm("Delete this task?")) {
      socket.emit("deleteTask", { taskId });
    }
  };

  const copyOutput = () => {
    if (selectedTask?.ai_output) {
      navigator.clipboard.writeText(selectedTask.ai_output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleTaskClick = (task) => {
    if (task.status === "done") setSelectedTask(task);
  };

  const switchToBoard = (targetBoard) => {
    if (!socket) return;
    if (board === targetBoard) return;

    setBoard(targetBoard);
    socket.emit("switchBoard", { board: targetBoard });
  };

  return (
    <div className="layout">
      <Sidebar />

      <div className="content-area">
        <div className="board-switch">
          <button
            className={board === "personal" ? "active" : ""}
            onClick={() => switchToBoard("personal")}
          >
            My Board
          </button>

          <button
            className={board === "main" ? "active" : ""}
            onClick={() => switchToBoard("main")}
          >
            Main Board
          </button>
        </div>

        <div className="board">
          <DragDropContext onDragEnd={onDragEnd}>
            {Object.entries(columns).map(([colId, list]) => (
              <Droppable droppableId={colId} key={colId}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`column ${colId}`}
                  >
                    <div className="column-color-bar"></div>

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
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="task-card"
                              onClick={() => handleTaskClick(task)}
                              onDoubleClick={() => startEditing(task)}
                            >
                              <button
                                className="delete-x"
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
                                  onChange={(e) =>
                                    setEditingTitle(e.target.value)
                                  }
                                  onBlur={() => saveEdit(task.id)}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && saveEdit(task.id)
                                  }
                                  autoFocus
                                />
                              ) : (
                                <>
                                  {task.priority && (
                                    <div
                                      className={`task-priority priority-${task.priority.toLowerCase()}`}
                                    >
                                      {task.priority}
                                    </div>
                                  )}

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

      {selectedTask && (
        <div className="popup-overlay" onClick={() => setSelectedTask(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={() => setSelectedTask(null)}>
              ✕
            </button>
            <h2>{selectedTask.title}</h2>
            <p>
              <strong>Status:</strong> {selectedTask.status}
            </p>

            <div className="popup-content">
              {selectedTask.ai_output || "No AI output available."}
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

      {showAddPopup && (
        <div className="popup-overlay" onClick={() => setShowAddPopup(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Task</h3>
            <input
              type="text"
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
