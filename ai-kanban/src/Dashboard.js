// Dashboard.js
import "./Dashboard.css";
import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";



const TIME_RANGES = ["today", "7d", "30d", "all"];

const rangeLabel = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

// Your Kanban statuses (from KanbanBoard.js)
const STATUS_TODO = "todo";
const STATUS_PROGRESS = "progress";
const STATUS_DONE = "done";

// ----- helpers -----
function getStartDate(range) {
  const now = new Date();
  if (range === "all") return null;

  const start = new Date(now);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(now.getDate() - 7);
  if (range === "30d") start.setDate(now.getDate() - 30);
  return start;
}

function safeDate(d) {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dayKeyLocal(d) {
  // YYYY-MM-DD (local)
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Build points for a polyline from "done tasks per day" for last N days
function buildDoneTrendPolyline(tasks, daysCount = 7, width = 480, height = 120) {
  const now = new Date();
  const days = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  const counts = {};
  days.forEach((d) => (counts[dayKeyLocal(d)] = 0));

  tasks.forEach((t) => {
    if (t.status !== STATUS_DONE) return;
    const dt = safeDate(t.updated_at || t.created_at);
    if (!dt) return;
    const k = dayKeyLocal(dt);
    if (k in counts) counts[k] += 1;
  });

  const values = days.map((d) => counts[dayKeyLocal(d)] || 0);
  const maxY = Math.max(1, ...values);
  const stepX = width / Math.max(1, days.length - 1);

  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / maxY) * (height - 10); // padding
    return `${x},${y}`;
  });

  return pts.join(" ");
}

export default function Dashboard({ user, profile }) {
  console.log("DASH user:", user?.id);

  const [timeRange, setTimeRange] = useState("today");

  // real tasks from socket
  const [tasks, setTasks] = useState([]);

  // live connection indicator
  const [socketConnected, setSocketConnected] = useState(false);

  // OPTIONAL: if you have a different backend URL in Codespaces, replace this:
  const SERVER_URL = "http://localhost:5000";

  // ----- connect socket (Option 1: Dashboard owns its own socket) -----
  useEffect(() => {
    if (!user?.id) return;

    const s = io(SERVER_URL, {
      query: { userId: user.id },
      transports: ["websocket"],
    });

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    s.on("loadTasks", (data) => setTasks(Array.isArray(data) ? data : []));
    s.on("updateTasks", (data) => setTasks(Array.isArray(data) ? data : []));

    // in case it connects instantly
    setSocketConnected(s.connected);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
    };
  }, [user?.id]);

  // ----- time range filtering -----
  const filteredTasks = useMemo(() => {
    const start = getStartDate(timeRange);
    if (!start) return tasks;

    return tasks.filter((t) => {
      const dt = safeDate(t.updated_at || t.created_at);
      if (!dt) return false;
      return dt >= start;
    });
  }, [tasks, timeRange]);

  // ----- KPI metrics -----
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const inProgress = filteredTasks.filter((t) => t.status === STATUS_PROGRESS).length;
    const completed = filteredTasks.filter((t) => t.status === STATUS_DONE).length;

    // Overdue requires a due_date column. If you don't have it, keep 0 for now.
    // If you DO have due_date, uncomment this:
    // const now = new Date();
    // const overdue = filteredTasks.filter(
    //   (t) => t.due_date && safeDate(t.due_date) && safeDate(t.due_date) < now && t.status !== STATUS_DONE
    // ).length;

    const overdue = 0;

    return { total, inProgress, completed, overdue };
  }, [filteredTasks]);

  // ----- Agent panel (derived from tasks.ai_agent + ai_status) -----
  const agents = useMemo(() => {
    const map = new Map();

    filteredTasks.forEach((t) => {
      const agentName = t.ai_agent;
      if (!agentName) return;
      if (!map.has(agentName)) map.set(agentName, []);
      map.get(agentName).push(t);
    });

    return Array.from(map.entries()).map(([agentName, list]) => {
      const thinking = list.find((x) => x.ai_status === "thinking");
      const inProg = list.find((x) => x.status === STATUS_PROGRESS);
      const latest = [...list].sort((a, b) => {
        const da = safeDate(a.updated_at || a.created_at)?.getTime() || 0;
        const db = safeDate(b.updated_at || b.created_at)?.getTime() || 0;
        return db - da;
      })[0];

      const current = thinking || inProg || latest;

      const status =
        current?.ai_status === "thinking"
          ? "Running"
          : current?.status === STATUS_PROGRESS
          ? "Active"
          : current?.status === STATUS_DONE
          ? "Completed"
          : "Idle";

      // If you later store ai_progress in DB, use that instead.
      const progress =
        current?.ai_status === "thinking"
          ? 60
          : current?.status === STATUS_PROGRESS
          ? 40
          : current?.status === STATUS_DONE
          ? 100
          : 0;

      return {
        id: agentName,
        name: agentName,
        status,
        task: current?.title || "—",
        progress,
      };
    });
  }, [filteredTasks]);

  // ----- Analytics (simple but real) -----
  const analytics = useMemo(() => {
    const total = metrics.total || 0;
    const completion = total === 0 ? 0 : Math.round((metrics.completed / total) * 100);

    const utilization =
      agents.length === 0
        ? 0
        : agents.filter((a) => a.status === "Running" || a.status === "Active").length / agents.length;

    // crude but usable until you track completed_at / due_date
    const rangeDays = timeRange === "today" ? 1 : timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 30;
    const throughput = Math.min(1, metrics.completed / Math.max(1, rangeDays));

    const efficiency = Math.min(1, (completion / 100) * (0.5 + utilization / 2));

    return { completion, utilization, throughput, efficiency };
  }, [metrics, agents, timeRange]);

  // ----- Feed (derived) -----
  const combinedFeed = useMemo(() => {
    const recent = [...filteredTasks]
      .sort((a, b) => {
        const da = safeDate(a.updated_at || a.created_at)?.getTime() || 0;
        const db = safeDate(b.updated_at || b.created_at)?.getTime() || 0;
        return db - da;
      })
      .slice(0, 8);

    return recent.map((t) => {
      if (t.ai_status === "thinking") return `AI is working on: ${t.title}`;
      if (t.status === STATUS_DONE) return `Task completed: ${t.title}`;
      if (t.status === STATUS_PROGRESS) return `In progress: ${t.title}`;
      return `Task updated: ${t.title}`;
    });
  }, [filteredTasks]);

  // ----- Line chart polyline points (real) -----
  const polyPoints = useMemo(() => {
    // show a 7-day trend regardless of timeRange so chart always looks sensible
    return buildDoneTrendPolyline(tasks, 7, 480, 120);
  }, [tasks]);

  return (
    <div className="dashboard-body">
      {/* PAGE HEADER */}
      <header className="dash-header-bar">
        <h1 className="page-title">Dashboard</h1>
        <div className="header-right">
          <input className="search-input" placeholder="Search tasks or agents..." />
          <div className="user-chip">{socketConnected ? "ON" : "OFF"}</div>
        </div>
      </header>

      {/* TOP KPI ROW */}
      <div className="stats-row">
        <div className="stats-card">
          <h4>Total Tasks</h4>
          <p>{metrics.total}</p>
          <span className="stat-sub">All tasks in the system</span>
        </div>
        <div className="stats-card">
          <h4>In Progress</h4>
          <p>{metrics.inProgress}</p>
          <span className="stat-sub">Currently being handled</span>
        </div>
        <div className="stats-card">
          <h4>Completed</h4>
          <p>{metrics.completed}</p>
          <span className="stat-sub">Successfully finished</span>
        </div>
        <div className="stats-card">
          <h4>Overdue</h4>
          <p className="overdue">{metrics.overdue}</p>
          <span className="stat-sub">Require attention</span>
        </div>
      </div>

      {/* TIME RANGE FILTER */}
      <div className="time-filter-row">
        <span className="time-filter-label">Time range:</span>
        <div className="time-filter-pills">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              className={`time-pill ${timeRange === range ? "active" : ""}`}
              onClick={() => setTimeRange(range)}
              type="button"
            >
              {rangeLabel[range]}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="main-grid">
        {/* TOP ROW: PIE + LINE */}
        <div className="grid-top">
          {/* PIE + METRICS */}
          <section className="panel analytics-panel">
            <div className="panel-header">
              <h2>Workflow Analytics</h2>
              <span className="panel-tag subtle">{rangeLabel[timeRange]}</span>
            </div>

            <div className="analytics-top">
              <div
                className="analytics-donut"
                style={{
                  "--donut-stop": `${analytics.completion}%`,
                }}
              >
                <div className="donut-inner">
                  <p>{analytics.completion}%</p>
                  <span>Overall progress</span>
                </div>
              </div>

              <div className="metrics-bars">
                <div className="metric-row">
                  <span>Agent Utilization</span>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${analytics.utilization * 100}%` }}
                    />
                  </div>
                </div>

                <div className="metric-row">
                  <span>Task Throughput</span>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${analytics.throughput * 100}%` }}
                    />
                  </div>
                </div>

                <div className="metric-row">
                  <span>AI Efficiency Score</span>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{ width: `${analytics.efficiency * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* LINE CHART */}
          <section className="panel linechart-panel">
            <div className="panel-header">
              <h2>Workflow Efficiency</h2>
              <span className="panel-tag subtle">Done trend (7 days)</span>
            </div>

            <div className="line-chart">
              <div className="line-chart-header">
                <span>Tasks completed over time</span>
                <span className="chart-period">Last 7 days</span>
              </div>

              <svg className="linechart-svg" viewBox="0 0 480 120" preserveAspectRatio="none">
                <polyline
                  className="chart-line"
                  points={polyPoints}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </section>
        </div>

        {/* BOTTOM ROW: FEED + AGENTS */}
        <div className="grid-bottom">
          {/* LIVE FEED */}
          <section className="panel feed-panel">
            <div className="panel-header">
              <h2>Live Activity Feed</h2>
              <span className="panel-tag subtle">{timeRange === "today" ? "Real-time" : "Historical"}</span>
            </div>

            <ul className="feed-list">
              {combinedFeed.length === 0 ? (
                <li className="feed-item">
                  <span className="plane-icon" />
                  <span>No recent activity.</span>
                </li>
              ) : (
                combinedFeed.map((item, index) => (
                  <li key={`${item}-${index}`} className="feed-item">
                    <span className="plane-icon" />
                    <span>{item}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* AGENT STATUS */}
          <section className="panel agent-panel">
            <div className="panel-header">
              <h2>Agent Status</h2>
              <span className="panel-tag">{socketConnected ? "Live" : "Offline"}</span>
            </div>

            {agents.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No agents found yet (assign AI to a task first).
              </div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-row">
                    <div>
                      <strong>{agent.name}</strong>
                      <p className="agent-task">Task: {agent.task}</p>
                    </div>
                    <span className={`agent-badge ${agent.status.toLowerCase()}`}>
                      {agent.status}
                    </span>
                  </div>

                  <div className="agent-progress">
                    <div className="agent-progress-fill" style={{ width: `${agent.progress}%` }} />
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
