import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Map as MapIcon, BarChart3, MapPin, X } from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/map", icon: MapIcon, label: "Map Overview" },
  { path: "/insights", icon: BarChart3, label: "Analytics" },
];

export default function Sidebar({ open, setOpen }) {
  const location = useLocation();

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-30 w-64 bg-white text-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 border-r border-slate-200 flex flex-col shadow-sm ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
            <MapPin size={18} className="text-white" />
          </div>
          <span className="font-bold tracking-tight text-lg text-slate-900">AI for Bharat</span>
        </div>
        <button className="lg:hidden p-1 text-slate-400 hover:text-slate-700 transition-colors" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-1.5 flex-1">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active 
                ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
              }`}
            >
              <item.icon size={18} className={active ? "text-emerald-600" : "text-slate-400"} />
              {item.label}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-100 text-xs text-center text-slate-400 font-medium">
        Hackathon Build
      </div>
    </aside>
  );
}
