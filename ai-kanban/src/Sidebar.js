import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  FiHome,
  FiGrid,
  FiList,
  FiLayout,
  FiUser,
  FiSettings,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

import "./Sidebar.css";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Add/remove body class when sidebar collapses/expands
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const getOrgIdFromPath = () => {
    const match = pathname.match(/^\/org\/([^/]+)/);
    return match ? match[1] : null;
  };

  const getActiveOrgId = () => {
    const orgIdFromUrl = getOrgIdFromPath();
    const savedOrgId = localStorage.getItem("activeOrgId");
    return orgIdFromUrl || savedOrgId;
  };

  const goKanban = () => {
    const orgId = getActiveOrgId();
    navigate(orgId ? `/org/${orgId}/kanban` : "/kanban");
  };

  const goWorkItems = () => {
    const orgId = getActiveOrgId();
    navigate(orgId ? `/org/${orgId}/workitems` : "/workitems");
  };

  // ✅ active states
  const isKanbanActive =
    pathname === "/kanban" || /^\/org\/[^/]+\/kanban$/.test(pathname);

  const isWorkItemsActive =
    pathname === "/workitems" || /^\/org\/[^/]+\/workitems$/.test(pathname);

  const links = [
    { to: "/organisations", label: "Organisation", icon: <FiHome /> },
    { to: "/dashboard", label: "Dashboard", icon: <FiLayout /> },
    { to: "/timeline", label: "Timeline", icon: <FiCalendar /> },
  ];

  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <h3 className="side-title">{!isCollapsed && "KIRO"}</h3>
        <button
          type="button"
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      <div className="side-links">
        {/* ✅ Organisation FIRST */}
        <Link
          to="/organisations"
          className={`side-link ${isActive("/organisations") ? "active" : ""}`}
          title={isCollapsed ? "Organisation" : ""}
        >
          <span className="icon">
            <FiHome />
          </span>
          {!isCollapsed && <span className="link-text">Organisation</span>}
        </Link>

        {/* ✅ Kanban */}
        <button
          type="button"
          onClick={goKanban}
          className={`side-link ${isKanbanActive ? "active" : ""}`}
          title={isCollapsed ? "Kanban Board" : ""}
        >
          <span className="icon">
            <FiGrid />
          </span>
          {!isCollapsed && <span className="link-text">Kanban Board</span>}
        </button>

        {/* ✅ WorkItems (NEW, org-aware) */}
        <button
          type="button"
          onClick={goWorkItems}
          className={`side-link ${isWorkItemsActive ? "active" : ""}`}
          title={isCollapsed ? "WorkItems" : ""}
        >
          <span className="icon">
            <FiList />
          </span>
          {!isCollapsed && <span className="link-text">WorkItems</span>}
        </button>

        {/* ✅ Rest */}
        {links
          .filter((l) => l.to !== "/organisations")
          .map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`side-link ${isActive(l.to) ? "active" : ""}`}
              title={isCollapsed ? l.label : ""}
            >
              <span className="icon">{l.icon}</span>
              {!isCollapsed && <span className="link-text">{l.label}</span>}
            </Link>
          ))}
      </div>

      <div className="side-bottom">
        <Link
          className={`side-link ${isActive("/profile") ? "active" : ""}`}
          to="/profile"
          title={isCollapsed ? "Profile" : ""}
        >
          <span className="icon">
            <FiUser />
          </span>
          {!isCollapsed && <span className="link-text">Profile</span>}
        </Link>

        <Link
          className={`side-link ${isActive("/settings") ? "active" : ""}`}
          to="/settings"
          title={isCollapsed ? "Settings" : ""}
        >
          <span className="icon">
            <FiSettings />
          </span>
          {!isCollapsed && <span className="link-text">Settings</span>}
        </Link>
      </div>
    </div>
  );
}