import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit }) => {
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-lg text-gray-500">{unit}</span>}
      </div>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
};
