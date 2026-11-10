import { Link } from "react-router-dom";

const BUTTON_VARIANTS = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/50",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:text-slate-400",
};

const buttonClass = (variant, size) =>
  `inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed ${
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm"
  } ${BUTTON_VARIANTS[variant]}`;

export function Button({ variant = "primary", size, className = "", ...props }) {
  return <button type="button" className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", size, className = "", ...props }) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Alert({ tone = "error", children }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-yellow-300 bg-yellow-50 text-yellow-900",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Card({ className = "", children }) {
  return <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</section>;
}

// Errors red, warnings yellow, info blue — everywhere severity is shown.
export const SEVERITY = {
  error: {
    label: "Errors",
    badge: "bg-red-50 text-red-700 ring-red-200",
    text: "text-red-600",
    dot: "bg-red-500",
    mark: "bg-red-100 decoration-red-500",
    markActive: "bg-red-200 ring-2 ring-red-500",
    border: "border-l-red-500",
  },
  warning: {
    label: "Warnings",
    badge: "bg-yellow-50 text-yellow-800 ring-yellow-300",
    text: "text-yellow-600",
    dot: "bg-yellow-400",
    mark: "bg-yellow-100 decoration-yellow-500",
    markActive: "bg-yellow-200 ring-2 ring-yellow-500",
    border: "border-l-yellow-400",
  },
  info: {
    label: "Info",
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    text: "text-blue-600",
    dot: "bg-blue-500",
    mark: "bg-blue-100 decoration-blue-500",
    markActive: "bg-blue-200 ring-2 ring-blue-500",
    border: "border-l-blue-500",
  },
};

export const SEVERITY_ORDER = ["error", "warning", "info"];

export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || { badge: "bg-slate-100 text-slate-700 ring-slate-200" };
  return (
    // Fixed size so Error/Warning/Info badges match and never stretch to a wrapped description's height.
    <span
      className={`inline-flex h-6 w-20 shrink-0 items-center justify-center self-start rounded-full text-xs leading-none font-medium whitespace-nowrap capitalize ring-1 ring-inset ${s.badge}`}
    >
      {severity}
    </span>
  );
}

export function ComingSoon({ children = "Coming soon" }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const tones = {
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partial: "bg-amber-50 text-amber-700 ring-amber-200",
    failed: "bg-red-50 text-red-700 ring-red-200",
    running: "bg-blue-50 text-blue-700 ring-blue-200",
    skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${
        tones[status] || tones.skipped
      }`}
    >
      {status}
    </span>
  );
}

export const fmt = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
