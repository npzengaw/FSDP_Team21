import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import KanbanBoard from "./components/KanbanBoard/kanbanBoard";
import WorkItems from "./components/WorkItems/WorkItems";
import "./index.css";

// Temporary placeholder for the main page
const Placeholder = () => (
  <div className="flex items-center justify-center h-screen text-gray-500 text-xl">
    <p>Main page placeholder — nothing here yet 👀</p>
  </div>
);

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Placeholder as the current main page */}
        <Route path="/" element={<Placeholder />} />

        {/* Actual feature pages */}
        <Route path="/kanban" element={<KanbanBoard />} />
        <Route path="/workitems" element={<WorkItems />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
