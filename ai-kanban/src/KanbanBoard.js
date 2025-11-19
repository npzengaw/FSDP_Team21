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
import { useNavigate, useParams } from "react-router-dom";

function KanbanBoard({ socket, tasks, user }) {
  const navigate = useNavigate();
  const { orgId } = useParams();

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

  /* FORMAT DATA */
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

  /* ADD TASK */
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    socket.emit("addTask", { title: newTaskTitle });
    setNewTaskTitle("");
    setShowAddPopup(false);
  };

  /* DRAG */
  const onDragEnd = (result) => {
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

  /* EDIT TITLE */
  const startEditing = (task) => {
    if (task.status !== "todo") return;
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = (id) => {
    if (!editingTitle.trim()) return;
    socket.emit("renameTask", { taskId: id, newTitle: editingTitle });
    setEditingTaskId(null);
  };

  const deleteTask = (id) => {
    if (window.confirm("Delete task?")) {
      socket.emit("deleteTask", { taskId: id });
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(selectedTask.ai_output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const switchBoard = (target) => {
    if (board === target) return;
    setBoard(target);
    socket.emit("switchBoard", { board: target });
  };

  return (
    <div className="layout">
      <Sidebar />

      {/* NEW WRAPPER */}
      <div className="kanban-wrapper" style={{ alignItems: "flex-start" }}>

        {/* TOP NAV CONTAINER */}
        <div className="top-container">
          <div className="top-tabs">
            <div className="top-tabs-left">
              <span className="active">Kanban Board</span>

              <span onClick={() => navigate(`/org/${orgId}/workitems`)}>
                WorkItems
              </span>
            </div>

            <div className="search-icon">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="20"
    width="20"
    viewBox="0 0 24 24"
    fill="#666"
  >
    <path d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.48-5.34C15.17 5.01 12.16 2 8.58 2S2 5.01 2 8.39c0 3.38 3.01 6.39 6.58 6.39 1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6.92 0C6.01 14 4 11.99 4 9.39 4 6.79 6.01 4.78 8.58 4.78s4.58 2.01 4.58 4.61c0 2.6-2.01 4.61-4.58 4.61z" />
  </svg>
</div>

          </div>

          <div className="top-divider"></div>

          <div className="board-switch-pills">
            <button
              className={board === "personal" ? "pill active" : "pill"}
              onClick={() => switchBoard("personal")}
            >
              My Board
            </button>

            <button
              className={board === "main" ? "pill active" : "pill"}
              onClick={() => switchBoard("main")}
            >
              Main Board
            </button>
          </div>
        </div>

        {/* MAIN KANBAN BOARD */}
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
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (task.status === "done")
                                  setSelectedTask(task);
                              }}
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
                          Add Task +
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

      {/* POPUPS */}
      {selectedTask && (
        <div className="popup-overlay" onClick={() => setSelectedTask(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="popup-close"
              onClick={() => setSelectedTask(null)}
            >
              ✕
            </button>

            <h2>{selectedTask.title}</h2>

            <div className="popup-content">
              {selectedTask.ai_output || "No AI output available"}
            </div>

            <div className="popup-footer">
              <button
                className="copy-btn"
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

              <button
                className="add-btn"
                onClick={handleAddTask}
              >
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



