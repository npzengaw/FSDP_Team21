import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App"; // Your main app
import KanbanBoard from "./components/KanbanBoard/kanbanBoard.tsx"; // Your new component
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />               {/* Default route */}
        <Route path="/kanban" element={<KanbanBoard />} /> {/* Kanban route */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
