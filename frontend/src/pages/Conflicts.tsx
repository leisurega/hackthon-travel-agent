import React from 'react';
import { HeatmapChart } from '../components/Charts';
import { useTrip } from '../contexts/TripContext';

const Conflicts: React.FC = () => {
  const { tripData } = useTrip();

  const stats = [
    { label: '总冲突数', value: tripData?.conflict_summary?.total || 12, color: 'blue' },
    { label: '高优先级冲突', value: tripData?.conflict_summary?.high_priority || 4, color: 'red' },
    { label: '硬冲突', value: tripData?.conflict_summary?.hard || 2, color: 'orange' },
    { label: '初始可行性', value: (tripData?.conflict_summary?.feasibility || 71) + '%', color: 'green' }
  ];

  const xAxis = ['A', 'B', 'C', 'D'];
  const yAxis = ['预算', '时间', '节奏', '兴趣', '饮食', '社交'];
  const heatmapData = tripData?.heatmap || [
    [0, 1, 3, 2],
    [1, 2, 1, 0],
    [3, 2, 0, 1],
    [0, 1, 2, 1],
    [2, 0, 2, 1],
    [1, 0, 1, 0]
  ];

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">冲突分析</h1>
        <p className="text-gray-500 mb-10">系统已识别成员间的关键差异与潜在冲突 ℹ️</p>
        
        <div className="grid grid-cols-4 gap-6 mb-10">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <div className={`w-2 h-2 rounded-full bg-${stat.color}-500`}></div>
                {stat.label}
              </div>
              <div className={`text-3xl font-black text-gray-800`}>{stat.value}</div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-12 gap-8">
          <section className="col-span-5 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold mb-8 text-gray-800 flex items-center justify-between">
              冲突热力矩阵 ℹ️
              <div className="flex gap-3 text-[10px] font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400"></span>低</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400"></span>中</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>高</span>
              </div>
            </h3>
            <div className="aspect-square">
              <HeatmapChart data={heatmapData} xAxis={xAxis} yAxis={yAxis} />
            </div>
            <p className="text-[10px] text-gray-400 mt-6 text-center">颜色越深，冲突程度越高</p>
          </section>
          
          <section className="col-span-7 space-y-4">
            <h3 className="text-base font-bold mb-4 text-gray-800">关键冲突列表</h3>
            <div className="space-y-4">
              {(tripData?.conflicts || [1, 2, 3, 4]).map((conflict: any, i: number) => (
                <div key={conflict.conflict_id || i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                    conflict.severity === '高' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
                  }`}>
                    {conflict.type === '节奏冲突' ? '⚡️' : conflict.type === '预算冲突' ? '💰' : conflict.type === '时间冲突' ? '⏰' : '🍴'}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-800">{conflict.title || '节奏冲突：A 偏向慢游，B 偏向打卡'}</h4>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        conflict.severity === '高' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>{conflict.severity || '高'}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      💡 {conflict.suggestion || '建议：在行程中安排“慢游+打卡”组合日，平衡节奏。'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {(conflict.users || ['A', 'B']).map((u: string) => (
                          <div key={u} className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white text-[10px] font-bold text-white flex items-center justify-center shadow-sm">{u}</div>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium ml-2">冲突类型：{conflict.type || '风格偏好'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        
        <div className="mt-12 flex justify-center gap-4">
          <button className="px-8 py-4 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all">
            ← 返回成员画像
          </button>
          <button className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
            生成候选方案 →
          </button>
        </div>
      </div>
    </div>
  );
};

export default Conflicts;
