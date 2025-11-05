import React, { useState } from 'react';
import './WorkItems.css';

interface WorkItem {
  id: string;
  taskName: string;
  description: string;
  estimation: string;
  type: string;
  people: string[];
  priority: string;
  status: 'todo' | 'inProgress' | 'completed';
}

const WorkItems: React.FC = () => {
  const [items, _setItems] = useState<WorkItem[]>([
    {
      id: '1',
      taskName: 'Design new landing page',
      description: 'Create mockups for the new landing page',
      estimation: '5 days',
      type: 'Design',
      people: ['John', 'Sarah'],
      priority: 'High',
      status: 'todo'
    },
    {
      id: '2',
      taskName: 'API Integration',
      description: 'Connect frontend to backend API',
      estimation: '3 days',
      type: 'Development',
      people: ['Mike'],
      priority: 'Medium',
      status: 'todo'
    },
    {
      id: '3',
      taskName: 'User Testing',
      description: 'Conduct user testing sessions',
      estimation: '2 days',
      type: 'Testing',
      people: ['Emma', 'Tom'],
      priority: 'Low',
      status: 'todo'
    },
    {
      id: '4',
      taskName: 'Database Migration',
      description: 'Migrate from MySQL to PostgreSQL',
      estimation: '4 days',
      type: 'Development',
      people: ['Alex'],
      priority: 'High',
      status: 'todo'
    },
    {
      id: '5',
      taskName: 'Fix login bug',
      description: 'Resolve authentication issues',
      estimation: '1 day',
      type: 'Bug Fix',
      people: ['Sarah'],
      priority: 'High',
      status: 'inProgress'
    },
    {
      id: '6',
      taskName: 'Update documentation',
      description: 'Update API documentation',
      estimation: '2 days',
      type: 'Documentation',
      people: ['John'],
      priority: 'Medium',
      status: 'inProgress'
    },
    {
      id: '7',
      taskName: 'Setup CI/CD',
      description: 'Configure continuous deployment',
      estimation: '3 days',
      type: 'DevOps',
      people: ['Mike', 'Alex'],
      priority: 'Medium',
      status: 'completed'
    },
    {
      id: '8',
      taskName: 'Code Review',
      description: 'Review pull requests',
      estimation: '1 day',
      type: 'Review',
      people: ['Emma'],
      priority: 'Low',
      status: 'completed'
    }
  ]);

  const [expandedSections, setExpandedSections] = useState({
    todo: true,
    inProgress: true,
    completed: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getItemsByStatus = (status: 'todo' | 'inProgress' | 'completed') => {
    return items.filter(item => item.status === status);
  };

  const renderItems = (status: 'todo' | 'inProgress' | 'completed') => {
    const statusItems = getItemsByStatus(status);
    
    return statusItems.map(item => (
      <div key={item.id} className="work-item-row">
        <div className="checkbox-cell">
          <input type="checkbox" />
        </div>
        <div className="task-name-cell">
          <span className="task-name">{item.taskName}</span>
        </div>
        <div className="description-cell">
          <span className="description">{item.description}</span>
        </div>
        <div className="estimation-cell">
          <span className="estimation">{item.estimation}</span>
        </div>
        <div className="type-cell">
          <span className="type">{item.type}</span>
        </div>
        <div className="people-cell">
          <div className="people-avatars">
            {item.people.map((person, idx) => (
              <div key={idx} className="avatar" title={person}>
                {person.charAt(0)}
              </div>
            ))}
          </div>
        </div>
        <div className="priority-cell">
          <span className={`priority priority-${item.priority.toLowerCase()}`}>
            {item.priority}
          </span>
        </div>
        <div className="actions-cell">
          <button className="action-btn">−</button>
        </div>
      </div>
    ));
  };

  return (
    <div className="work-items-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Tasks</h3>
          <button className="close-btn">×</button>
        </div>
        <div className="pages-section">
          <h4>PAGES</h4>
          <div className="page-item">Page 1</div>
          <div className="page-item">Page 2</div>
          <div className="page-item">Page 3</div>
          <div className="page-item">Page 4</div>
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <span className="welcome-text">Welcome Back</span>
          </div>
          <div className="header-right">
            <div className="search-bar">
              <input type="text" placeholder="Search..." />
            </div>
            <button className="icon-btn"></button>
            <button className="icon-btn"></button>
          </div>
        </div>

        <div className="work-items-content">
          <h1>Work Items</h1>

          <div className="section">
            <div className="section-header" onClick={() => toggleSection('todo')}>
              <span className="expand-icon">{expandedSections.todo ? '∨' : '›'}</span>
              <span className="section-title">To Do</span>
              <span className="section-count">{getItemsByStatus('todo').length}</span>
              <button className="add-btn">+</button>
            </div>
            {expandedSections.todo && (
              <>
                <div className="table-header">
                  <div className="checkbox-cell"></div>
                  <div className="task-name-cell">
                    <span>Task Name</span>
                  </div>
                  <div className="description-cell">
                    <span>Description</span>
                  </div>
                  <div className="estimation-cell">
                    <span>Estimation</span>
                  </div>
                  <div className="type-cell">
                    <span>Type</span>
                  </div>
                  <div className="people-cell">
                    <span>People</span>
                  </div>
                  <div className="priority-cell">
                    <span>Priority</span>
                  </div>
                  <div className="actions-cell">×</div>
                </div>
                {renderItems('todo')}
              </>
            )}
          </div>

          <div className="section">
            <div className="section-header" onClick={() => toggleSection('inProgress')}>
              <span className="expand-icon">{expandedSections.inProgress ? '∨' : '›'}</span>
              <span className="section-title">In Progress</span>
              <span className="section-count">{getItemsByStatus('inProgress').length}</span>
              <button className="add-btn">+</button>
            </div>
            {expandedSections.inProgress && (
              <>
                <div className="table-header">
                  <div className="checkbox-cell"></div>
                  <div className="task-name-cell">
                    <span>Task Name</span>
                  </div>
                  <div className="description-cell">
                    <span>Description</span>
                  </div>
                  <div className="estimation-cell">
                    <span>Estimation</span>
                  </div>
                  <div className="type-cell">
                    <span>Type</span>
                  </div>
                  <div className="people-cell">
                    <span>People</span>
                  </div>
                  <div className="priority-cell">
                    <span>Priority</span>
                  </div>
                  <div className="actions-cell">×</div>
                </div>
                {renderItems('inProgress')}
              </>
            )}
          </div>

          <div className="section">
            <div className="section-header" onClick={() => toggleSection('completed')}>
              <span className="expand-icon">{expandedSections.completed ? '∨' : '›'}</span>
              <span className="section-title">Completed</span>
              <span className="section-count">{getItemsByStatus('completed').length}</span>
              <button className="add-btn">+</button>
            </div>
            {expandedSections.completed && (
              <>
                <div className="table-header">
                  <div className="checkbox-cell"></div>
                  <div className="task-name-cell">
                    <span>Task Name</span>
                  </div>
                  <div className="description-cell">
                    <span>Description</span>
                  </div>
                  <div className="estimation-cell">
                    <span>Estimation</span>
                  </div>
                  <div className="type-cell">
                    <span>Type</span>
                  </div>
                  <div className="people-cell">
                    <span>People</span>
                  </div>
                  <div className="priority-cell">
                    <span>Priority</span>
                  </div>
                  <div className="actions-cell">×</div>
                </div>
                {renderItems('completed')}
              </>
            )}
          </div>

          <div className="add-column">
            <button className="add-column-btn">Add new column +</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkItems;