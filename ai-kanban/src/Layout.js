import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }) {
  const [sidebarWidth, setSidebarWidth] = useState(230);

  useEffect(() => {
    // Listen for sidebar collapse state changes
    const checkSidebarState = () => {
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      setSidebarWidth(isCollapsed ? 55 : 230);
    };

    // Check initial state
    checkSidebarState();

    // Watch for class changes on body
    const observer = new MutationObserver(checkSidebarState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Sidebar />
      <div 
        style={{ 
          paddingLeft: sidebarWidth, 
          minHeight: "100vh",
          transition: "padding-left 0.3s ease"
        }}
      >
        {children}
      </div>
    </>
  );
}