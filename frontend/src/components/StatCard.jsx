/**
 * StatCard — minimal metric card
 * Props: icon (ReactNode), label, value, badge, badgeStyle, sublabel, delay, accent
 */
export default function StatCard({ icon, label, value, badge, badgeStyle, sublabel, delay = 0, accent = "#4F46E5" }) {
  return (
    <div
      className="surface-card rounded-xl p-5 anim-fade-up hover:shadow-md transition-shadow duration-200"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}12` }}
        >
          {icon}
        </div>
        {badge && badgeStyle && (
          <span className="badge" style={badgeStyle}>{badge}</span>
        )}
      </div>

      {/* Value */}
      <p className="metric-value anim-count-up" style={{ animationDelay: `${delay + 80}ms` }}>
        {value}
      </p>

      {/* Label */}
      <p className="text-xs font-medium mt-1" style={{ color: "#9CA3AF" }}>{label}</p>

      {/* Sublabel */}
      {sublabel && (
        <p className="text-xs mt-2" style={{ color: "#D1D5DB" }}>{sublabel}</p>
      )}
    </div>
  );
}
