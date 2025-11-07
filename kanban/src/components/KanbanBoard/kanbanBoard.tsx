import React, { useState } from 'react';
import './kanbanBoard.css';

const KanbanBoard = () => {
  const [tasks] = useState({
    todo: [
      { id: 1, title: 'Task Title', description: 'Task description goes here', hasAttachment: true, hasComments: true },
      { id: 2, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false },
      { id: 3, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false },
      { id: 4, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false },
      { id: 5, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false }
    ],
    inProgress: [
      { id: 6, title: 'Task Title', description: 'Task description goes here', hasAttachment: true, hasComments: true, hasSubtask: true, subtaskProgress: '1/2' },
      { id: 7, title: 'Task Title', description: 'Task description goes here', hasAttachment: true, hasComments: true },
      { id: 8, title: 'Task Title', description: 'Task description goes here', hasAttachment: true, hasComments: true }
    ],
    completed: [
      { id: 9, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false },
      { id: 10, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false },
      { id: 11, title: 'Task Title', description: 'Task description goes here', hasAttachment: false, hasComments: false }
    ]
  });

  const [showMenu, setShowMenu] = useState<number | null>(null);

  return (
    <div className="kanban-container">
      <div className="sidebar">
        <div className="logo">
          <div className="logo-placeholder"></div>
        </div>
        
        <div className="tasks-section">
          <div className="tasks-header">
            <span>Tasks</span>
            <span className="task-count">16</span>
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

        <div className="board">
          <div className="column">
            <div className="column-header">
              <div className="column-title">To Do</div>
            </div>
            <div className="tasks-list">
              {tasks.todo.map((task) => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <div className="task-title-bar"></div>
                    <button className="task-menu" onClick={() => setShowMenu(showMenu === task.id ? null : task.id)}>⋮</button>
                    {showMenu === task.id && (
                      <div className="menu-dropdown">
                        <div className="menu-item">Edit</div>
                        <div className="menu-item">Delete</div>
                      </div>
                    )}
                  </div>
                  <div className="task-description">Task description placeholder</div>
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

          <div className="column">
            <div className="column-header">
              <div className="column-title">In Progress</div>
            </div>
            <div className="tasks-list">
              {tasks.inProgress.map((task) => (
                <div key={task.id} className="task-card">
                  {task.hasSubtask && (
                    <div className="subtask-overlay">
                      <div className="subtask-title">Subtask Name</div>
                    </div>
                  )}
                  <div className="task-header">
                    <div className="task-title-bar"></div>
                    <button className="task-menu" onClick={() => setShowMenu(showMenu === task.id ? null : task.id)}>⋮</button>
                    {showMenu === task.id && (
                      <div className="menu-dropdown">
                        <div className="menu-item">Edit</div>
                        <div className="menu-item">Delete</div>
                      </div>
                    )}
                  </div>
                  <div className="task-description">Task description placeholder</div>
                  {task.hasSubtask && (
                    <div className="subtask-progress">
                      <span className="icon">☑</span>
                      <span>{task.subtaskProgress}</span>
                    </div>
                  )}
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
            </div>
          </div>

          <div className="column">
            <div className="column-header">
              <div className="column-title">Completed</div>
            </div>
            <div className="tasks-list">
              {tasks.completed.map((task) => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <div className="task-title-bar"></div>
                    <button className="task-menu" onClick={() => setShowMenu(showMenu === task.id ? null : task.id)}>⋮</button>
                    {showMenu === task.id && (
                      <div className="menu-dropdown">
                        <div className="menu-item">Edit</div>
                        <div className="menu-item">Delete</div>
                      </div>
                    )}
                  </div>
                  <div className="task-description">Task description placeholder</div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;