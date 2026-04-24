import React from 'react';
import { useTrip } from '../contexts/TripContext';

const Replan: React.FC = () => {
  const { tripData } = useTrip();

  const replanDiff = tripData?.replan_diff || {
    event_title: "第 3 天下雨",
    impact_range: "Day 3 户外活动",
    disturbance: "小",
    most_affected: ["A:-6", "B:-2", "C:-1", "D:0"],
    compensated: ["B:+5", "C:+2", "D:+1", "A:0"],
    how_adjusted: [
      "将 Day 3 户外活动替换为室内行程",
      "延后日落拍摄至 Day 4 进行补偿",
      "保持总预算与每日节奏基本不变",
      "最小化成员偏好与体验扰动"
    ]
  };

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">动态重排</h1>
        <p className="text-gray-500 mb-10">在突发事件下对当前方案进行最小扰动调整 ℹ️</p>
        
        <div className="bg-orange-50 border border-orange-100 p-8 rounded-3xl flex items-center gap-8 mb-10 shadow-sm">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-orange-50">⚠️</div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-xl font-black text-orange-700">事件：{replanDiff.event_title}</div>
              <span className="px-3 py-1 bg-orange-200 text-orange-800 text-[10px] font-black rounded-full uppercase">天气变化</span>
            </div>
            <p className="text-sm text-orange-600 font-medium opacity-80">
              影响范围：{replanDiff.impact_range} · 扰动范围：{replanDiff.disturbance}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-8 grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span> 原计划
              </h3>
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm opacity-50 grayscale-[0.5]">
                <div className="flex justify-between items-center mb-8">
                  <div className="font-black text-gray-800">Day 3 · 巴黎</div>
                  <span className="text-[10px] text-gray-400">🌧 降雨概率 90%</span>
                </div>
                <div className="space-y-4">
                  {[
                    { time: '09:00', title: '城市步行', icon: '🚶‍♂️' },
                    { time: '12:30', title: '户外拍照', icon: '📸' },
                    { time: '18:30', title: '日落机位', icon: '🌅' }
                  ].map(item => (
                    <div key={item.time} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                      <div className="text-[10px] font-black text-gray-400 w-10">{item.time}</div>
                      <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <span>{item.icon}</span> {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-xs font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> 新计划 
                <span className="text-[10px] bg-green-100 px-2 py-0.5 rounded-lg font-black ml-1">已优化</span>
              </h3>
              <div className="bg-white p-8 rounded-3xl border-2 border-green-500 shadow-2xl shadow-green-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2">
                  <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-black rotate-12 shadow-lg border-4 border-white">NEW</div>
                </div>
                <div className="font-black text-gray-900 mb-8">Day 3 · 巴黎</div>
                <div className="space-y-4">
                  {[
                    { time: '09:30', title: '室内展览', icon: '🖼', status: 'replace' },
                    { time: '13:00', title: '咖啡馆休息', icon: '☕️', status: 'replace' }
                  ].map(item => (
                    <div key={item.time} className="p-5 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-4 relative">
                      <div className="text-[10px] font-black text-green-600 w-10">{item.time}</div>
                      <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <span>{item.icon}</span> {item.title}
                      </div>
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-dashed border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Day 4 (调整) · 巴黎</div>
                    <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">补偿机制触发</span>
                  </div>
                  <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-4 relative">
                    <div className="text-[10px] font-black text-blue-600 w-10">18:30</div>
                    <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span>🌅</span> 补回日落拍摄
                    </div>
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-span-4 space-y-8">
            <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold mb-8 text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-orange-500 rounded-full"></span> 调整总结
              </h3>
              <div className="space-y-8">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    谁受影响最大 ℹ️
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {replanDiff.most_affected.map((s: string) => (
                      <div key={s} className={`px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2 shadow-sm ${
                        s.includes('-') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${s.includes('-') ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{s.split(':')[0]}</div>
                        {s.split(':')[1]}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    谁得到补偿 ℹ️
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {replanDiff.compensated.map((s: string) => (
                      <div key={s} className={`px-4 py-2 rounded-2xl font-black text-sm flex items-center gap-2 shadow-sm ${
                        s.includes('+') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${s.includes('+') ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{s.split(':')[0]}</div>
                        {s.split(':')[1]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            
            <section className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold mb-6 text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 系统如何调整
              </h3>
              <ul className="space-y-4">
                {replanDiff.how_adjusted.map((t: string) => (
                  <li key={t} className="text-xs text-gray-600 font-medium flex items-start gap-3 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></span> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-8 pt-8 border-t border-gray-50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">新评分概览 ℹ️</span>
                  <span className="text-2xl font-black text-blue-600">88<span className="text-xs font-normal text-gray-300 ml-1">/100</span></span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: '整体满意度', val: 86, inc: 4 },
                    { label: '体验丰富度', val: 88, inc: 3 },
                    { label: '行程可行性', val: 92, inc: 2 },
                    { label: '预算控制', val: 89, inc: 1 }
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500 font-bold">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-700">{item.val}</span>
                        <span className="text-[8px] font-black text-green-500 flex items-center">↑ {item.inc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
        
        <div className="mt-12 flex justify-center gap-6">
          <button className="px-10 py-4 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all">
            👤 人工确认
          </button>
          <button className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
            <span>✅</span> 接受调整
          </button>
        </div>
      </div>
    </div>
  );
};

export default Replan;
