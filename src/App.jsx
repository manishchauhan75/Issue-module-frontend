import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ValidationPage from "./pages/ValidationPage";
import DashboardPage from "./pages/DashboardPage";
import IssueGroupsPage from "./pages/IssueGroupsPage";
import FileErrorsPage from "./pages/FileErrorsPage";
import { useSnapshot } from "./context/SnapshotContext";
import { MODULES } from "./modules";

function RequireSnapshot({ children }) {
  const { snapshotId } = useSnapshot();
  return snapshotId ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ValidationPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireSnapshot>
              <DashboardPage />
            </RequireSnapshot>
          }
        />
        {MODULES.map((m) => (
          <Route
            key={m.key}
            path={m.path}
            element={
              <RequireSnapshot>
                <IssueGroupsPage key={m.key} moduleKey={m.key} />
              </RequireSnapshot>
            }
          />
        ))}
        {MODULES.filter((m) => m.getFileErrors).map((m) => (
          <Route
            key={`${m.key}-file`}
            path={`${m.path}/files/:fileId`}
            element={
              <RequireSnapshot>
                <FileErrorsPage key={m.key} moduleKey={m.key} />
              </RequireSnapshot>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
