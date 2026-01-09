import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import KanbanBoard from "../KanbanBoard";

export default function OrgBoardPage({ user }) {
  const [socket, setSocket] = useState(null);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    if (!user) return;

    const s = io("http://localhost:5000", {
      transports: ["websocket"],
      query: {
        userId: user.id, // ✅ PERSONAL ONLY
      },
    });

    setSocket(s);

    s.on("loadTasks", (taskList) => {
      if (Array.isArray(taskList)) setTasks(taskList);
    });

    s.on("updateTasks", (taskList) => {
      if (Array.isArray(taskList)) setTasks(taskList);
    });

    return () => s.disconnect();
  }, [user]);

  return socket ? (
    <KanbanBoard socket={socket} tasks={tasks} user={user} />
  ) : (
    <p style={{ padding: "20px" }}>Connecting to board...</p>
  );
}
