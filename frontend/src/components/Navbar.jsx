import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map as MapIcon,
  Lightbulb,
  Menu,
  X,
  Zap,
} from "lucide-react";

const navLinks = [
  { name: "Dashboard", path: "/dashboard", Icon: LayoutDashboard },
  { name: "Map", path: "/map", Icon: MapIcon },
  { name: "Insights", path: "/insights", Icon: Lightbulb },
];

export default function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="app-nav sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-6 md:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 select-none">
          <span
            className="font-bold text-lg  tracking-tight"
            style={{ color: "#111827" }}
          >
            EV Optimus
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map(({ name, path, Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={name}
                to={path}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors duration-150"
                style={{
                  color: active ? "#4F46E5" : "#6B7280",
                  background: active ? "#EEF2FF" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={15} />
                {name}
              </Link>
            );
          })}
        </div>

        {/* Live indicator */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
            Live
          </span>
        </div>

        {/* Mobile */}
        <button
          className="md:hidden p-1.5 rounded-lg"
          style={{ color: "#6B7280" }}
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden mx-4 mb-3 rounded-xl overflow-hidden surface-card anim-fade-in">
          {navLinks.map(({ name, path, Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={name}
                to={path}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                style={{
                  color: active ? "#4F46E5" : "#374151",
                  background: active ? "#EEF2FF" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={15} />
                {name}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
