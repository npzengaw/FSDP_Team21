import Sidebar from "./Sidebar";

const SIDEBAR_WIDTH = 230;

export default function Layout({ children }) {
  return (
    <>
      <Sidebar />
      <div style={{ paddingLeft: SIDEBAR_WIDTH, minHeight: "100vh" }}>
        {children}
      </div>
    </>
  );
}
