import React from 'react';
import DatePicker from 'react-datepicker';
import { vi } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

interface DateRangeFilterProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

export function DateRangeFilter({ startDate, endDate, onChange }: DateRangeFilterProps) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Khoảng thời gian
      </label>
      <div className="flex items-center gap-2">
        <DatePicker
          selected={startDate}
          onChange={(date: Date | null) => date && onChange(date, endDate)}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={60}
          dateFormat="dd/MM/yyyy HH:mm"
          locale={vi}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2
                     text-sm text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
        <span className="text-gray-400 text-sm">→</span>
        <DatePicker
          selected={endDate}
          onChange={(date: Date | null) => date && onChange(startDate, date)}
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate}
          showTimeSelect
          timeFormat="HH:mm"
          timeIntervals={60}
          dateFormat="dd/MM/yyyy HH:mm"
          locale={vi}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2
                     text-sm text-gray-700 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>
    </div>
  );
}
