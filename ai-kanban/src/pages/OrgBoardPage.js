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
        userId: user.id,
      },
    });

    setSocket(s);

    s.on("loadTasks", (list) => {
      if (Array.isArray(list)) setTasks(list);
    });

    s.on("updateTasks", (list) => {
      if (Array.isArray(list)) setTasks(list);
    });

    return () => {
      s.disconnect();
    };
  }, [user]);

  if (!socket) {
    return <p style={{ padding: 20 }}>Connecting to board...</p>;
  }

  return <KanbanBoard socket={socket} tasks={tasks} user={user} />;
}
