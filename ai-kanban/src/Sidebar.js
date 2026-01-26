import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiHome,
  FiGrid,
  FiLayout,
  FiUser,
  FiSettings,
  FiCalendar,
} from "react-icons/fi";
import "./Sidebar.css";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

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
    <div className="sidebar">
      <h3 className="side-title">KIRO</h3>

      <div className="side-links">
        {/* ✅ Organisation FIRST */}
        <Link
          to="/organisations"
          className={`side-link ${isActive("/organisations") ? "active" : ""}`}
        >
          <span className="icon">
            <FiHome />
          </span>
          Organisation
        </Link>

        {/* ✅ Kanban */}
        <button
          type="button"
          onClick={goKanban}
          className={`side-link ${isKanbanActive ? "active" : ""}`}
        >
          <span className="icon">
            <FiGrid />
          </span>
          Kanban Board
        </button>

        {/* ✅ WorkItems (NEW, org-aware) */}
        <button
          type="button"
          onClick={goWorkItems}
          className={`side-link ${isWorkItemsActive ? "active" : ""}`}
        >
          <span className="icon">
            <FiGrid />
          </span>
          WorkItems
        </button>

        {/* ✅ Rest */}
        {links
          .filter((l) => l.to !== "/organisations")
          .map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`side-link ${isActive(l.to) ? "active" : ""}`}
            >
              <span className="icon">{l.icon}</span>
              {l.label}
            </Link>
          ))}
      </div>

      <div className="side-bottom">
        <Link
          className={`side-link ${isActive("/profile") ? "active" : ""}`}
          to="/profile"
        >
          <span className="icon">
            <FiUser />
          </span>
          Profile
        </Link>

        <Link
          className={`side-link ${isActive("/settings") ? "active" : ""}`}
          to="/settings"
        >
          <span className="icon">
            <FiSettings />
          </span>
          Settings
        </Link>
      </div>
    </div>
  );
}
