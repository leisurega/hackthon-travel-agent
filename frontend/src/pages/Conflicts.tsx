import React from 'react';

const Conflicts: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-2">冲突分析</h1>
      <p className="text-gray-500 mb-8">系统已识别成员间的关键差异与潜在冲突</p>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '总冲突数', value: 12, color: 'blue' },
          { label: '高优先级冲突', value: 4, color: 'red' },
          { label: '硬冲突', value: 2, color: 'orange' },
          { label: '初始可行性', value: '71%', color: 'green' }
        ].map(stat => (
          <div key={stat.label} className="bg-white p-4 rounded-xl border shadow-sm">
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-6 flex items-center justify-between">
            冲突热力矩阵
            <div className="flex gap-2 text-[10px] font-normal">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-100"></span>低</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-100"></span>中</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-100"></span>高</span>
            </div>
          </h3>
          <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-xs">
            [热力矩阵占位]
          </div>
        </section>
        
        <section className="space-y-4">
          <h3 className="font-bold mb-2">关键冲突列表</h3>
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-4 rounded-xl border shadow-sm flex gap-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                ⚠️
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-sm">节奏冲突：A 偏向慢游，B 偏向打卡</h4>
                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">高</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">建议：在行程中安排“慢游+打卡”组合日，平衡节奏。</p>
                <div className="flex gap-1">
                  <div className="w-5 h-5 bg-blue-100 rounded-full text-[10px] flex items-center justify-center">A</div>
                  <div className="w-5 h-5 bg-blue-100 rounded-full text-[10px] flex items-center justify-center">B</div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
      
      <div className="mt-8 flex justify-center">
        <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
          生成候选方案 →
        </button>
      </div>
    </div>
  );
};

export default Conflicts;
