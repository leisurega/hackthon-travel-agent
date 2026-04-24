import React from 'react';

const Replan: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-2">动态重排</h1>
      <p className="text-gray-500 mb-8">在突发事件下对当前方案进行最小扰动调整</p>
      
      <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl">⚠️</div>
        <div>
          <div className="font-bold text-red-600">事件：第 3 天下雨</div>
          <p className="text-sm text-red-500">影响范围：Day 3 户外活动 · 触发原因：天气变化 · 扰动范围：小</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">原计划</h3>
            <div className="bg-white p-4 rounded-xl border shadow-sm opacity-60">
              <div className="font-bold text-sm mb-4">Day 3 · 巴黎</div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                  <div className="text-[10px] text-gray-400 mb-1">09:00</div>
                  <div className="text-xs font-bold">城市步行</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                  <div className="text-[10px] text-gray-400 mb-1">12:30</div>
                  <div className="text-xs font-bold">户外拍照</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-green-600 uppercase tracking-wider flex items-center gap-2">
              新计划 <span className="text-[10px] bg-green-100 px-1.5 py-0.5 rounded font-normal">已优化</span>
            </h3>
            <div className="bg-white p-4 rounded-xl border-2 border-green-500 shadow-lg">
              <div className="font-bold text-sm mb-4">Day 3 · 巴黎</div>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <div className="text-[10px] text-green-600 mb-1">09:30</div>
                  <div className="text-xs font-bold">室内展览</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <div className="text-[10px] text-green-600 mb-1">13:00</div>
                  <div className="text-xs font-bold">咖啡馆休息</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-dashed">
                <div className="text-[10px] text-gray-400 mb-2">Day 4 (调整) · 巴黎</div>
                <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                  <div className="text-[10px] text-blue-600 mb-1">18:30</div>
                  <div className="text-xs font-bold">补回日落拍摄</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold mb-4 text-sm">调整总结</h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-2">谁受影响最大</div>
                <div className="flex gap-2">
                  {['A -6', 'B -2', 'C -1', 'D 0'].map(s => (
                    <span key={s} className={`text-[10px] px-2 py-1 rounded ${s.includes('-') ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-2">谁得到补偿</div>
                <div className="flex gap-2">
                  {['B +5', 'C +2', 'D +1', 'A 0'].map(s => (
                    <span key={s} className={`text-[10px] px-2 py-1 rounded ${s.includes('+') ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
          
          <section className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold mb-4 text-sm">系统如何调整</h3>
            <ul className="space-y-2">
              {[
                '将 Day 3 户外活动替换为室内行程',
                '延后日落拍摄至 Day 4 进行补偿',
                '保持总预算与每日节奏基本不变',
                '最小化成员偏好与体验扰动'
              ].map(t => (
                <li key={t} className="text-[10px] text-gray-600 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">●</span> {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
      
      <div className="mt-8 flex justify-center gap-4">
        <button className="px-8 py-3 border rounded-lg font-medium">人工确认</button>
        <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-lg shadow-blue-200">接受调整</button>
      </div>
    </div>
  );
};

export default Replan;
