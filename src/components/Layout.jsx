import { NavLink, Outlet } from "react-router-dom";
import { useSnapshot } from "../context/SnapshotContext";
import { MODULES } from "../modules";

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-brand-100 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export default function Layout() {
  const { snapshotId } = useSnapshot();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <span className="text-lg font-semibold tracking-tight text-brand-700">metR Issues</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={linkClass}>
              Validate
            </NavLink>
            {snapshotId && (
              <>
                <NavLink to="/dashboard" className={linkClass}>
                  Dashboard
                </NavLink>
                {MODULES.map((m) => (
                  <NavLink key={m.key} to={m.path} className={linkClass}>
                    {m.title}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
          {snapshotId && (
            <span className="ml-auto truncate rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">
              snapshot: {snapshotId}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
