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

export const fetchStationPriority = () =>
  fetchCSV("/data/station_build_priority.csv");
export const fetchCoverageGaps = () =>
  fetchCSV("/data/coverage_gap_analysis.csv");
export const fetchSmartRerouting = () => fetchCSV("/data/smart_rerouting.csv");
export const fetchChargingSchedule = () => fetchCSV("/data/charging_schedule.csv");

// Fetch ev dataset
export const fetchFinalEVData = () =>
  fetchCSV("/data/final_ev_dataset.csv");
