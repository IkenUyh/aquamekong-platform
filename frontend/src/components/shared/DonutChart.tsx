import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  totalLabel?: string;
  totalValue?: number | string;
}

export function DonutChart({ data, totalLabel, totalValue }: DonutChartProps) {
  return (
    <div className="relative w-full h-[160px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            stroke="none"
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            itemStyle={{ color: '#1e293b', fontSize: '12px', fontWeight: 600 }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {totalValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-800 leading-none">{totalValue}</span>
          <span className="text-xs text-gray-500 mt-1">{totalLabel}</span>
        </div>
      )}
    </div>
  );
}
