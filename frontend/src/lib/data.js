import Papa from "papaparse";

// Zone color palette — professional dark-based palette
export const ZONE_COLORS = {
  A: "#0f172a", // slate-900 (deep dark blue/grey)
  B: "#064e3b", // emerald-900 (deep green)
  C: "#1e3a8a", // blue-900 (navy)
  D: "#3f3f46", // zinc-700 (dark grey)
  E: "#0f766e", // teal-700 (deep teal)
};

export const ZONE_COORDS = {
  A: { lat: 12.97, lon: 77.59 },
  B: { lat: 12.98, lon: 77.6 },
  C: { lat: 12.96, lon: 77.58 },
  D: { lat: 12.99, lon: 77.61 },
  E: { lat: 12.95, lon: 77.57 },
};

export const PEAK_THRESHOLD = 150;

export function getDemandLabel(demand) {
  return demand >= PEAK_THRESHOLD ? "PEAK" : "OFF-PEAK";
}

export function getZoneColor(zone) {
  return ZONE_COLORS[zone] || "#0f172a";
}

export function formatHour(h) {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

export const API_BASE_URL = "http://127.0.0.1:8000";

export const fetchCSV = (url, limit = null) => {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      preview: limit || 0,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
};

// API Fetchers
export const fetchStationPriority = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/zone/station-priority`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    // Normalize data: ensure ranked_zones exists or return empty
    return data.ranked_zones || [];
  } catch (err) {
    console.error("API Error (Station Priority):", err);
    // When falling back to CSV, we need to ensure the structure matches
    const csvData = await fetchCSV("/data/station_build_priority.csv");
    return csvData;
  }
};

export const fetchCoverageGaps = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/zone/coverage-gaps`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return (data.gaps || []).map(g => {
      const zonesInvolved = g.zones_involved || (g.gap_pair ? g.gap_pair.replace(/ /g, '').split('↔') : []);
      return {
        ...g,
        // Map backend fields to frontend expectations
        fw_path: g.floyd_warshall_path || g.fw_path,
        recommended_zone: g.recommended_intermediate_zone || g.recommended_zone,
        build_rank: g.intermediate_build_rank || g.build_rank,
        zones_involved: zonesInvolved
      };
    });
  } catch (err) {
    console.error("API Error (Coverage Gaps):", err);
    const csvData = await fetchCSV("/data/coverage_gap_analysis.csv");
    return csvData.map(g => ({
      ...g,
      zones_involved: g.gap_pair ? g.gap_pair.replace(/ /g, '').split('↔') : [],
      recommended_zone: g.recommended_zone // Already correct in CSV
    }));
  }
};

export const fetchSmartRerouting = async (fromZone = null) => {
  const zoneParam = fromZone ? fromZone.toUpperCase() : "A";
  try {
    const url = `${API_BASE_URL}/zone/reroute?from_zone=${zoneParam}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    
    // Normalize backend 'fw_path' to 'path' for the frontend components
    return (data.all_alternatives || []).map(alt => ({
      ...alt,
      path: alt.fw_path,
      dest_overloaded: alt.penalty_applied
    }));
  } catch (err) {
    console.error("API Error (Rerouting):", err);
    // Fallback to CSV - apply the same normalization
    const csvData = await fetchCSV("/data/smart_rerouting.csv");
    return csvData
      .filter(d => d.from_zone === zoneParam)
      .map(d => ({
        ...d,
        fw_path: d.path, // Mirror path to fw_path for components using both
        penalty_applied: d.dest_overloaded === "True" || d.dest_overloaded === true
      }));
  }
};

export const fetchChargingSchedule = () =>
  fetchCSV("/data/charging_schedule.csv");

// Fetch ev dataset
export const fetchFinalEVData = () => fetchCSV("/data/final_ev_dataset.csv");

// New AI endpoints
export const predictDemand = async (dataWindow) => {
  try {
    const res = await fetch(`${API_BASE_URL}/predict/demand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_window: dataWindow }),
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to predict demand");
    }
    return res.json();
  } catch (err) {
    console.error("API Error (Predict Demand):", err);
    throw err;
  }
};

export const getModelMetadata = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/model/metadata`);
    if (!res.ok) throw new Error("Failed to fetch model metadata");
    return res.json();
  } catch (err) {
    console.error("API Error (Model Metadata):", err);
    return null;
  }
};
