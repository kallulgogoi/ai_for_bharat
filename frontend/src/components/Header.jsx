import { Search, Menu } from "lucide-react";

export default function Header({ onMenuClick }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 sticky top-0 z-20 w-full">
      <button 
        className="lg:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-800"
        onClick={onMenuClick}
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 flex items-center">
        <div className="relative w-full max-w-md hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search zones, stations, or data..." 
            className="w-full bg-slate-50 border border-slate-100 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
          />
        </div>
      </div>
    </header>
  );
}
