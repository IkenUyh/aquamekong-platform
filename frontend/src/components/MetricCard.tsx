interface MetricCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

export function MetricCard({ label, value, icon, color = 'text-white' }: MetricCardProps) {
  return (
    <div className="glass-card p-3 flex items-center gap-3 hover:bg-dark-card/40 transition-colors">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      </div>
    </div>
  );
}
