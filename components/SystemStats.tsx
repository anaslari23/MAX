
import React from 'react';
import { SystemStats as SystemStatsType } from '../types';
import { Icons } from '../constants';

interface SystemStatsProps {
  stats: SystemStatsType;
}

const SystemStats: React.FC<SystemStatsProps> = ({ stats }) => {
  return (
    <div className="flex flex-col gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl w-64">
      <div className="flex items-center gap-2 text-cyan-400 font-space text-xs font-bold uppercase tracking-wider">
        <Icons.Cpu />
        <span>System Diagnostics</span>
      </div>

      <div className="space-y-4">
        <StatBar label="CPU Usage" value={stats.cpu} />
        <StatBar label="Memory" value={stats.ram} />
        <StatBar label="Disk Space" value={stats.disk} />
        <StatBar label="Battery" value={stats.battery} />
      </div>
      
      <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase tracking-tighter">
        <span>Uptime: 14:23:01</span>
        <span>Local IP: 127.0.0.1</span>
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div 
        className="h-full bg-cyan-500 transition-all duration-1000 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export default SystemStats;
