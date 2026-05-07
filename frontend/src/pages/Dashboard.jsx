import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Clock,
  BatteryCharging,
  TrendingUp,
  MapPin,
  AlertTriangle,
  Activity,
  Zap,
  CheckCircle,
  Filter,
} from "lucide-react";
import StatCard from "../components/StatCard";
import { Slider } from "../components/ui/slider";
import {
  ZONE_COLORS,
  fetchStationPriority,
  fetchCoverageGaps,
  fetchFinalEVData,
  predictDemand,
} from "../lib/data";

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-slate-900 rounded-lg px-3 py-2 text-xs shadow-xl border border-slate-700"
      style={{ minWidth: 130 }}
    >
      <p className="font-semibold mb-1 text-slate-300 text-[11px]">
        {typeof label === "number" ? `${label}:00` : `Zone ${label}`}
      </p>
      {payload.map((p) => (
        <div
          key={p.dataKey || p.name}
          className="flex items-center gap-2 mb-0.5"
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-slate-400">
            {p.name ?? p.dataKey}:{" "}
            <strong className="text-white">
              {p.value?.toFixed ? p.value.toFixed(2) : p.value}
            </strong>
          </span>
        </div>
      ))}
    </div>
  );
};

function AIDemandPredictor({ demandByHour }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prepare 6 steps of 2 hours each = 12 hours
      // Each step: [consumption_rate_kw, energy_drawn_kwh, ...other features]
      // For demo, we'll use actual demand data from the chart
      const last12Hours = demandByHour.slice(-6).map(d => [
        75.0,           // Battery_Capacity_kWh
        50.0,           // State_of_Charge_%
        0.15,           // Energy_Consumption_Rate_kWh/km
        20.0,           // Distance_to_Destination_km
        2,              // Traffic_Data
        d.count * 15.5, // Charging_Rate_kW (Proxy from demand count)
        5.0,            // Queue_Time_mins
        10,             // Station_Capacity_EV
        45.0,           // Time_Spent_Charging_mins
        d.energy,       // Energy_Drawn_kWh
        d.hour,         // Session_Start_Hour
        50,             // Fleet_Size
        25.0 + Math.random() * 10, // Temperature_C
        0.0,            // Precipitation_mm
        new Date().getDay(), // Weekday
        1,              // Charging_Preferences
        1,              // Road_Average (One-hot)
        0,              // Road_Good (One-hot)
        0,              // Road_Poor (One-hot)
        new Date().getDay(), // day_of_week
        new Date().getDay() < 5 ? 1 : 0, // is_weekday
        d.hour          // hour
      ]);

      if (last12Hours.length < 6) {
        // Pad if not enough data with a neutral vector
        const neutralStep = [75, 50, 0.15, 20, 2, 100, 5, 10, 45, 150, 12, 50, 25, 0, 1, 1, 1, 0, 0, 1, 1, 12];
        while (last12Hours.length < 6) {
          last12Hours.unshift(neutralStep);
        }
      }

      const result = await predictDemand(last12Hours);
      setPrediction(result);
    } catch (err) {
      console.error("Prediction failed", err);
      setError(err.message || "AI engine unavailable. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg mb-6">
      <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Zap className="text-emerald-400" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Demand Forecaster</h3>
            <p className="text-sm text-slate-400">RNN-based temporal attention model for next-step load prediction</p>
          </div>
        </div>
        <button 
          onClick={handlePredict}
          disabled={loading}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Activity size={18} />
          )}
          {loading ? "Analyzing..." : "Run AI Prediction"}
        </button>
      </div>

      {error && (
        <div className="mx-5 mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
          <AlertTriangle size={18} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {prediction && prediction.prediction && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Predicted Demand</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">{prediction.prediction.demand_percentage}%</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${prediction.prediction.risk_level === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {prediction.prediction.risk_level} Risk
              </span>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Dominant Influence</p>
            <p className="text-sm font-semibold text-white">{prediction.ai_insight?.dominant_influence_window}</p>
            <p className="text-[10px] text-slate-400 mt-1">Attention Score: {prediction.ai_insight?.attention_score}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Model Analysis</p>
            <p className="text-xs text-slate-300 leading-snug">{prediction.ai_insight?.analysis}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, iconColor = "#0f172a" }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100">
        <Icon size={15} color={iconColor} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && (
          <p className="text-xs mt-0.5 text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [priorityData, setPriorityData] = useState([]);
  const [gapData, setGapData] = useState([]);
  const [evData, setEvData] = useState([]);

  // Time filters using a single range state
  const [timeRange, setTimeRange] = useState([0, 23]);

  useEffect(() => {
    async function loadData() {
      try {
        const [priorityRes, gapRes, evRes] = await Promise.all([
          fetchStationPriority(),
          fetchCoverageGaps(),
          fetchFinalEVData(),
        ]);

        setPriorityData(priorityRes.filter((d) => d.zone));
        setGapData(gapRes.filter((d) => d.gap_pair));
        setEvData(evRes.filter((d) => d.Session_Start_Hour !== undefined));
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered dataset
  const filteredEvData = useMemo(() => {
    return evData.filter((d) => {
      const dtPart = d.Date_Time?.split(" ")[1];
      const h = dtPart ? parseInt(dtPart.split(":")[0], 10) : parseInt(d.Session_Start_Hour, 10);
      return h >= timeRange[0] && h <= timeRange[1];
    });
  }, [evData, timeRange]);

  const totalEVs = filteredEvData.length;

  const demandByHour = useMemo(() => {
    const hours = [];
    for (let i = timeRange[0]; i <= timeRange[1]; i++) {
      hours.push({ hour: i, count: 0, energy: 0 });
    }

    filteredEvData.forEach((row) => {
      // Parse hour from Date_Time (format: "1/1/2017 0:00")
      const dtPart = row.Date_Time?.split(" ")[1];
      const h = dtPart ? parseInt(dtPart.split(":")[0], 10) : parseInt(row.Session_Start_Hour, 10);
      
      const hourObj = hours.find((x) => x.hour === h);
      if (hourObj) {
        hourObj.count += 1;
        hourObj.energy += row.Energy_Drawn_kWh || 0;
      }
    });
    return hours;
  }, [filteredEvData, timeRange]);

  const peakHourObj = useMemo(() => {
    if (!demandByHour.length) return { hour: 0, count: 0 };
    return demandByHour.reduce((prev, current) =>
      prev.count > current.count ? prev : current,
    );
  }, [demandByHour]);

  const topZone = useMemo(() => {
    if (!priorityData.length) return null;
    return [...priorityData].sort((a, b) => b.build_score - a.build_score)[0];
  }, [priorityData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-t-slate-800 border-slate-200 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">
          Loading datasets...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            EV Demand Dashboard
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            Infrastructure planning & analytics overview
          </p>
        </div>

        {/* Timeline Filter Slider */}
        <div className="flex flex-col gap-3 bg-white px-5 py-4 rounded-xl border border-slate-200 shadow-sm w-full xl:max-w-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold text-slate-700">
                Timeline Filter
              </span>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
              {timeRange[0]}:00 - {timeRange[1]}:00
            </span>
          </div>
          <div className="px-2">
            <Slider
              value={timeRange}
              onValueChange={setTimeRange}
              min={0}
              max={23}
              step={1}
              className="mt-2"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium px-2">
            <span>Midnight (0:00)</span>
            <span>Noon (12:00)</span>
            <span>11:00 PM (23:00)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Zap size={18} className="text-black" />}
          label="Filtered Sessions"
          value={totalEVs.toLocaleString()}
          badge="Active range"
          badgeStyle={{ background: "#f1f5f9", color: "#334155" }}
          sublabel="Based on timeline selection"
          accent="#0f172a"
        />
        <StatCard
          icon={<Clock size={18} className="text-black" />}
          label="Peak Demand Hour"
          value={`${peakHourObj.hour}:00`}
          badge={`${peakHourObj.count} sessions`}
          badgeStyle={{ background: "#ecfdf5", color: "#047857" }}
          sublabel="Highest load in selection"
          accent="#064e3b"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-indigo-black" />}
          label="Top Priority Zone"
          value={`Zone ${topZone?.zone || "-"}`}
          badge={`Score ${topZone?.build_score?.toFixed(2) || 0}`}
          badgeStyle={{ background: "#e0e7ff", color: "#4338ca" }}
          sublabel={
            topZone ? `${topZone.stations_recommended} new stations rec.` : ""
          }
          accent="#1e3a8a"
        />
        <StatCard
          icon={<AlertTriangle size={18} className="text-black" />}
          label="Coverage Gaps"
          value={gapData.length}
          badge="Action req."
          badgeStyle={{ background: "#fef2f2", color: "#b91c1c" }}
          sublabel="Underserved routes identified"
          accent="#991b1b"
        />
      </div>

      <AIDemandPredictor demandByHour={demandByHour} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <SectionTitle
            icon={Activity}
            title="Charging Demand Overview"
            subtitle="Total charging sessions per hour for selected timeline"
            iconColor="#0f172a"
          />
          <div style={{ width: "100%", height: 260, padding: "0 16px 20px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={demandByHour}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RTooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: "#475569" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="count"
                  name="Sessions"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="energy"
                  name="Energy (kWh)"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <SectionTitle
            icon={MapPin}
            title="Station Build Priority"
            subtitle="Calculated build scores by zone"
            iconColor="#0f172a"
          />
          <div style={{ width: "100%", height: 260, padding: "0 16px 20px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={priorityData}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="zone"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `Zone ${v}`}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RTooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: "#475569" }}
                />
                <Bar
                  dataKey="build_score"
                  name="Build Score"
                  fill="#0f172a"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
                <Bar
                  dataKey="stations_recommended"
                  name="Rec. Stations"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            Coverage Gaps Action Plan
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Gap Pair</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Rec. Zone</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">
                    Cost Reduction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gapData.map((gap, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {gap.gap_pair}
                    </td>
                    <td className="px-4 py-3">{gap.raw_distance_km} km</td>
                    <td className="px-4 py-3">Zone {gap.recommended_zone}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium text-xs border border-emerald-100">
                        {gap.cost_reduction_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            Zone Congestion Analysis
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Zone</th>
                  <th className="px-4 py-3">Congestion Index</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priorityData.slice(0, 5).map((zone, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      Zone {zone.zone}
                    </td>
                    <td className="px-4 py-3">
                      {(zone.congestion_index / 1000).toFixed(1)}k
                    </td>
                    <td className="px-4 py-3">
                      {zone.overloaded ? (
                        <span className="inline-flex text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-medium text-xs border border-red-100">
                          Overloaded
                        </span>
                      ) : (
                        <span className="inline-flex text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium text-xs border border-emerald-100">
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
