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
  const [selectedZone, setSelectedZone] = useState(null);
  const [rerouteLoading, setRerouteLoading] = useState(false);
  
  const [filters, setFilters] = useState({ stations: true, gaps: true, rerouting: true });

  useEffect(() => {
    async function loadData() {
      try {
        const [priorityRes, gapRes, routeRes] = await Promise.all([
          fetchStationPriority(),
          fetchCoverageGaps(),
          fetchSmartRerouting("A") // Initial load for Zone A
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

  const handleZoneSelect = async (zone) => {
    setSelectedZone(zone);
    setRerouteLoading(true);
    try {
      const routeRes = await fetchSmartRerouting(zone.zone);
      setReroutingData(routeRes.filter(d => d.path));
    } catch (err) {
      console.error("Reroute Fetch Error", err);
    } finally {
      setRerouteLoading(false);
    }
  };

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
                <span><strong className="text-white">Colored Dots</strong> represent key Zones. The larger the dot, the higher the priority to build new charging stations. Click a zone to see AI rerouting suggestions.</span>
              </li>
              <li className="flex gap-3">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span><strong className="text-red-400">Dashed Red Lines</strong> indicate severe coverage gaps where EV drivers run out of charge. Click the line for mitigation plans.</span>
              </li>
              <li className="flex gap-3">
                <ArrowRight size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong className="text-emerald-400">Dashed Emerald Lines</strong> show our AI Rerouting paths. It shifts traffic from overloaded zones to underutilized ones.</span>
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

            {/* Coverage Gaps (Red dashed lines between zones) */}
            {filters.gaps && gapData.map((gap, idx) => {
              const z1 = gap.zones_involved?.[0];
              const z2 = gap.zones_involved?.[1];
              if (!z1 || !z2) return null;
              
              const c1 = ZONE_COORDS[z1];
              const c2 = ZONE_COORDS[z2];
              if (!c1 || !c2) return null;

              const positions = [[c1.lat, c1.lon], [c2.lat, c2.lon]];

              return (
                <div key={`gap-group-${idx}`}>
                  {/* Invisible wider line for easier clicking */}
                  <Polyline
                    positions={positions}
                    pathOptions={{ color: 'transparent', weight: 15 }}
                  >
                    <Popup>
                      <div className="p-3 min-w-[240px]">
                        <div className="flex items-center gap-2 mb-3 text-red-600">
                          <AlertTriangle size={18} />
                          <span className="font-bold text-base">Critical Coverage Gap</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                            <span className="text-slate-500 font-medium">Corridor:</span>
                            <span className="font-bold text-slate-800">{gap.gap_pair}</span>
                          </div>
                          <div className="flex justify-between items-center px-2">
                            <span className="text-slate-500">Raw Distance:</span>
                            <span className="font-bold text-slate-800">{gap.raw_distance_km} km</span>
                          </div>
                          <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100 shadow-sm">
                            <p className="font-bold text-red-700 mb-1 text-xs uppercase tracking-wider">Mitigation Plan</p>
                            <p className="text-red-800 font-semibold mb-1">Station Deployment Required</p>
                            <p className="text-red-600 text-xs italic">Build at Zone {gap.recommended_zone} to bridge the gap.</p>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                  {/* Visible dashed line */}
                  <Polyline
                    positions={positions}
                    pathOptions={{
                      color: "#ef4444",
                      weight: 3,
                      dashArray: "10, 10",
                      opacity: 0.8
                    }}
                  />
                </div>
              );
            })}

            {/* Station Markers & Priority */}
            {filters.stations && markers.map(zone => (
              <CircleMarker 
                key={zone.zone}
                center={[zone.lat, zone.lon]} 
                radius={zone.stations_recommended ? (zone.stations_recommended * 2.5) + 8 : 10}
                pathOptions={{ 
                  color: zone.hasGap ? "#ef4444" : "#ffffff", 
                  fillColor: ZONE_COLORS[zone.zone] || "#0f172a", 
                  fillOpacity: 0.95, 
                  weight: zone.hasGap ? 4 : 2 
                }}
                eventHandlers={{
                  click: () => handleZoneSelect(zone),
                }}
              >
                <Popup className="custom-popup">
                  <div className="font-sans p-2" style={{ minWidth: 280 }}>
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: ZONE_COLORS[zone.zone] || "#0f172a", border: '2px solid white', boxShadow: '0 0 0 1px #e2e8f0' }} />
                      <span className="font-bold text-slate-900 text-lg tracking-tight">Zone {zone.zone} Analysis</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">EV Density</p>
                        <p className="text-sm font-bold text-slate-800">{zone.ev_density}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Priority</p>
                        <p className="text-sm font-bold text-indigo-600">{zone.build_score?.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Integrated AI Reroute Recommendation */}
                    {selectedZone?.zone === zone.zone && (
                      <div className="mt-2 p-4 bg-indigo-50 rounded-xl border border-indigo-100 shadow-inner animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Zap size={18} className="text-indigo-600" />
                            <span className="text-xs uppercase font-black text-indigo-800 tracking-wider">AI Optimal Path</span>
                          </div>
                          {rerouteLoading && <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />}
                        </div>

                        {reroutingData.length > 0 ? (
                          <div className="space-y-3">
                            <div className="p-2 bg-white/60 rounded-md border border-white">
                               <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Dynamic Routing Path</p>
                               <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                                  {reroutingData[0].fw_path?.split('→').map((p, i, arr) => (
                                    <span key={i} className="flex items-center gap-2">
                                      <span className="bg-slate-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{p}</span>
                                      {i < arr.length - 1 && <ArrowRight size={12} className="text-slate-400" />}
                                    </span>
                                  ))}
                               </div>
                            </div>
                            <div className="flex justify-between items-center px-1">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-indigo-400 font-bold">Efficiency Score</span>
                                <span className="text-sm font-black text-indigo-700">{reroutingData[0].effective_cost.toFixed(1)}</span>
                              </div>
                              <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${reroutingData[0].penalty_applied ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {reroutingData[0].penalty_applied ? 'Congested' : 'Clear Path'}
                              </div>
                            </div>
                          </div>
                        ) : !rerouteLoading && (
                          <p className="text-xs text-slate-500 italic text-center py-2">No optimal alternatives currently required</p>
                        )}
                      </div>
                    )}

                    {zone.stations_recommended > 0 && !rerouteLoading && (
                      <div className="mt-4 bg-emerald-600 text-white text-xs px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20">
                        <MapPin size={14} /> Recommended +{zone.stations_recommended} Station Deployment
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
