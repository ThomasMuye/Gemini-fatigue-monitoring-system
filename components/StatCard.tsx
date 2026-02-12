
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  status?: 'normal' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, status = 'normal' }) => {
  const statusColors = {
    normal: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-rose-500',
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
      <div className="p-3 bg-slate-800 rounded-lg text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold mono ${statusColors[status]}`}>{value}</span>
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
