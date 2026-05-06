import { ZONE_COLORS, getDemandStatusColor } from "../lib/data";

export default function ChargingTable({ rows, hour }) {
  const filtered = rows.filter((r) => r.hour === hour);

  if (!filtered.length) {
    return (
      <div className="flex items-center justify-center h-20 text-sm" style={{ color: "#9CA3AF" }}>
        No data for this hour.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm data-table">
        <thead>
          <tr>
            {["Zone", "EV Count", "Demand", "Status"].map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#9CA3AF" }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => {
            const statusStyle = getDemandStatusColor(row.recommendation);
            const maxDemand = 400;
            const pct = Math.min(100, (row.demand / maxDemand) * 100);
            return (
              <tr
                key={row.zone}
                className="anim-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Zone */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: ZONE_COLORS[row.zone] || "#4F46E5" }}
                    />
                    <span className="font-medium text-sm" style={{ color: "#111827" }}>
                      Zone {row.zone}
                    </span>
                  </div>
                </td>

                {/* EV Count */}
                <td className="px-4 py-3 font-mono text-sm" style={{ color: "#374151" }}>
                  {row.ev_count?.toLocaleString()}
                </td>

                {/* Demand with mini bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: row.recommendation === "PEAK" ? "#DC2626" : "#059669",
                          opacity: 0.65,
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums" style={{ color: "#6B7280" }}>
                      {row.demand}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className="badge"
                    style={statusStyle}
                  >
                    {row.recommendation}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
