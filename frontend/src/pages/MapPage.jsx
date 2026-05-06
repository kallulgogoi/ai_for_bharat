import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import { Layers, AlertTriangle, ArrowRight, Info, MapPin, Zap } from "lucide-react";
import { 
  ZONE_COLORS, ZONE_COORDS,
  fetchStationPriority, fetchCoverageGaps, fetchSmartRerouting 
} from "../lib/data";
import "leaflet/dist/leaflet.css";

const LAYERS = [
  { key: "stations",        label: "Existing Stations & Priorities", color: "#0f172a", icon: MapPin },
  { key: "gaps",            label: "Coverage Gaps", color: "#DC2626", icon: AlertTriangle },
  { key: "rerouting",       label: "Smart Rerouting Paths", color: "#059669", icon: ArrowRight },
];

function LayerToggle({ checked, onChange, color, label, icon: Icon }) {
  return (
    <div 
      onClick={onChange}
      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
        checked ? "border-slate-800 bg-slate-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${checked ? 'bg-white shadow-sm' : 'bg-slate-50'}`}>
          <Icon size={16} color={checked ? color : "#94a3b8"} />
        </div>
        <span className={`text-sm font-medium ${checked ? "text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
        checked ? "border-slate-800" : "border-slate-300"
      }`}>
        {checked && <div className="w-2 h-2 bg-slate-800 rounded-full" />}
      </div>
    </div>
  );
}

export default function MapPage() {
  const [loading, setLoading] = useState(true);
  const [priorityData, setPriorityData] = useState([]);
  const [gapData, setGapData] = useState([]);
  const [reroutingData, setReroutingData] = useState([]);
  
  const [filters, setFilters] = useState({ stations: true, gaps: true, rerouting: true });

  useEffect(() => {
    async function loadData() {
      try {
        const [priorityRes, gapRes, routeRes] = await Promise.all([
          fetchStationPriority(),
          fetchCoverageGaps(),
          fetchSmartRerouting()
        ]);
        setPriorityData(priorityRes.filter(d => d.zone));
        setGapData(gapRes.filter(d => d.gap_pair));
        setReroutingData(routeRes.filter(d => d.path));
      } catch (err) {
        console.error("Map Data Load Error", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggle = key => setFilters(p => ({ ...p, [key]: !p[key] }));

  // Process data for rendering
  const markers = useMemo(() => {
    return priorityData.map(zone => {
      const coords = ZONE_COORDS[zone.zone] || { lat: 12.97, lon: 77.59 };
      const hasGap = gapData.some(g => g.gap_pair.includes(zone.zone));
      return { ...zone, ...coords, hasGap };
    });
  }, [priorityData, gapData]);

  const paths = useMemo(() => {
    return reroutingData.map(route => {
      const parts = route.path.match(/[A-E]/g) || [];
      const latlngs = parts.map(z => ZONE_COORDS[z]).filter(Boolean).map(c => [c.lat, c.lon]);
      return { ...route, latlngs, parts };
    }).filter(r => r.latlngs.length > 1);
  }, [reroutingData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-slate-800 border-slate-200 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading map engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Infrastructure Map</h1>
        <p className="text-sm mt-1 text-slate-500">
          Interactive view of EV demand, station distribution, and routing paths
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[600px]">
        {/* Interactive Legend / Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">Map Layers</h2>
            </div>
            
            <div className="space-y-3">
              {LAYERS.map(l => (
                <LayerToggle
                  key={l.key}
                  checked={filters[l.key]}
                  onChange={() => toggle(l.key)}
                  color={l.color}
                  label={l.label}
                  icon={l.icon}
                />
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-md p-5 text-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Info size={18} className="text-emerald-400" />
              <h2 className="text-base font-semibold text-white">How to Read This Map</h2>
            </div>
            <ul className="space-y-4 text-sm mt-4">
              <li className="flex gap-3">
                <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <span><strong className="text-white">Colored Dots</strong> represent key Zones. The larger the dot, the higher the priority to build new charging stations.</span>
              </li>
              <li className="flex gap-3">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span><strong className="text-red-400">Red Pulsing Halos</strong> indicate severe coverage gaps where EV drivers run out of charge.</span>
              </li>
              <li className="flex gap-3">
                <ArrowRight size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-emerald-400">Dashed Lines</strong> show our AI Rerouting paths. It shifts traffic from overloaded zones to underutilized ones.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Map Canvas */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
          <MapContainer center={[12.97, 77.59]} zoom={13} scrollWheelZoom className="h-full w-full z-0 absolute inset-0">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">Carto</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            {/* Smart Rerouting Paths */}
            {filters.rerouting && paths.map((route, idx) => (
               <Polyline 
                 key={`route-${idx}`} 
                 positions={route.latlngs} 
                 pathOptions={{ 
                   color: route.dest_overloaded ? "#ef4444" : "#10b981", 
                   weight: 4, 
                   opacity: 0.8,
                   dashArray: "8 8"
                 }} 
               >
                  <Popup className="custom-popup">
                    <div className="font-sans text-sm p-1">
                      <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <Zap size={14} className="text-emerald-500" /> AI Rerouting Path
                      </p>
                      <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3 bg-slate-50 py-1.5 px-3 rounded-md border border-slate-100">
                         {route.parts.map((p, i) => (
                           <span key={i} className="flex items-center gap-1.5">
                             {p} {i < route.parts.length - 1 && <ArrowRight size={14} className="text-slate-400" />}
                           </span>
                         ))}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Effective Cost</span>
                        <span className="font-bold text-slate-700">{route.effective_cost?.toFixed(2)}</span>
                      </div>
                      {route.dest_overloaded && (
                        <div className="mt-3 bg-red-50 text-red-700 px-2 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 border border-red-100">
                          <AlertTriangle size={12} /> Destination Overloaded
                        </div>
                      )}
                    </div>
                  </Popup>
               </Polyline>
            ))}

            {/* Coverage Gaps (Red halos) */}
            {filters.gaps && markers.filter(m => m.hasGap).map(zone => (
              <CircleMarker 
                key={`gap-${zone.zone}`}
                center={[zone.lat, zone.lon]} 
                radius={30}
                pathOptions={{ 
                  color: "#ef4444", 
                  fillColor: "#ef4444", 
                  fillOpacity: 0.15, 
                  weight: 2,
                  dashArray: "4 4"
                }} 
              />
            ))}

            {/* Station Markers & Priority */}
            {filters.stations && markers.map(zone => (
              <CircleMarker 
                key={zone.zone}
                center={[zone.lat, zone.lon]} 
                radius={zone.stations_recommended ? (zone.stations_recommended * 2) + 6 : 8}
                pathOptions={{ 
                  color: "#ffffff", 
                  fillColor: ZONE_COLORS[zone.zone] || "#0f172a", 
                  fillOpacity: 0.9, 
                  weight: 2 
                }}>
                <Popup className="custom-popup">
                  <div className="font-sans p-1" style={{ minWidth: 200 }}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: ZONE_COLORS[zone.zone] || "#0f172a" }} />
                      <span className="font-bold text-slate-900 text-base">Zone {zone.zone}</span>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center"><span className="text-slate-500 text-xs">Population</span><span className="font-semibold text-slate-700 text-xs">{zone.population}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500 text-xs">EV Density</span><span className="font-semibold text-slate-700 text-xs">{zone.ev_density}</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500 text-xs">Existing Stations</span><span className="font-semibold text-slate-700 text-xs">{zone.existing_stations}</span></div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                        <span className="text-slate-500 text-xs font-semibold">Priority Score</span>
                        <span className="font-bold text-indigo-600 text-sm">{zone.build_score?.toFixed(2)}</span>
                      </div>
                    </div>
                    {zone.stations_recommended > 0 && (
                      <div className="mt-1 bg-emerald-50 text-emerald-700 text-xs px-3 py-1.5 rounded-md font-bold flex items-center justify-center gap-1.5 border border-emerald-100">
                        <MapPin size={12} /> Rec. +{zone.stations_recommended} Stations
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          </MapContainer>
        </div>
      </div>
    </div>
  );
}
