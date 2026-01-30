// src/Sidebar.js
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FiHome,
  FiGrid,
  FiLayout,
  FiUser,
  FiSettings,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useLocale } from "./LocaleContext";
import "./Sidebar.css";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // ✅ locale + translator from context
  const { t } = useLocale();

  // Add/remove body class when sidebar collapses/expands
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add("sidebar-collapsed");
    } else {
      document.body.classList.remove("sidebar-collapsed");
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
    { to: "/organisations", label: t("nav.organisation"), icon: <FiHome /> },
    { to: "/dashboard", label: t("nav.dashboard"), icon: <FiLayout /> },
    { to: "/timeline", label: t("nav.timeline"), icon: <FiCalendar /> },
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
          title={isCollapsed ? t("nav.organisation") : ""}
        >
          <span className="icon">
            <FiHome />
          </span>
          {!isCollapsed && (
            <span className="link-text">{t("nav.organisation")}</span>
          )}
        </Link>

        {/* ✅ Kanban */}
        <button
          type="button"
          onClick={goKanban}
          className={`side-link ${isKanbanActive ? "active" : ""}`}
          title={isCollapsed ? t("nav.kanban") : ""}
        >
          <span className="icon">
            <FiGrid />
          </span>
          {!isCollapsed && (
            <span className="link-text">{t("nav.kanban")}</span>
          )}
        </button>

        {/* ✅ WorkItems (org-aware) */}
        <button
          type="button"
          onClick={goWorkItems}
          className={`side-link ${isWorkItemsActive ? "active" : ""}`}
          title={isCollapsed ? t("nav.workitems") : ""}
        >
          <span className="icon">
            <FiGrid />
          </span>
          {!isCollapsed && (
            <span className="link-text">{t("nav.workitems")}</span>
          )}
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
          title={isCollapsed ? t("nav.profile") : ""}
        >
          <span className="icon">
            <FiUser />
          </span>
          {!isCollapsed && (
            <span className="link-text">{t("nav.profile")}</span>
          )}
        </Link>

        <Link
          className={`side-link ${isActive("/settings") ? "active" : ""}`}
          to="/settings"
          title={isCollapsed ? t("nav.settings") : ""}
        >
          <span className="icon">
            <FiSettings />
          </span>
          {!isCollapsed && (
            <span className="link-text">{t("nav.settings")}</span>
          )}
        </Link>
      </div>
    </div>
  );
}
