import React, { useState } from 'react';
import { useTrip } from '../contexts/TripContext';
import { tripApi } from '../api/trip';

const iconFor = (kind?: string, is_indoor?: boolean) => {
  switch (kind) {
    case 'museum': return '🏛';
    case 'restaurant': return '🍜';
    case 'walk': return '🚶';
    case 'photo': return '📸';
    case 'shopping': return '🛍';
    case 'transit': return '🚄';
    default: return is_indoor ? '🏠' : '📍';
  }
};

const Replan: React.FC = () => {
  const { tripData, tripId, refreshTrip } = useTrip();
  const [triggering, setTriggering] = useState(false);

  const replanDiff = tripData?.replan_diff;
  const oldScore = replanDiff?.old_score?.final;
  const newScore = replanDiff?.new_score?.final ?? tripData?.scores?.final;

  const handleTrigger = async () => {
    if (!tripId) return;
    setTriggering(true);
    try {
      await tripApi.postEvent(tripId, 'day3_rain');
      await refreshTrip();
    } finally {
      setTriggering(false);
    }
  };

  if (!replanDiff) {
    return (
      <div className="p-10 h-full overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">动态重排</h1>
          <p className="text-gray-500 mb-10">触发一个突发事件，Agent 将对当前方案做最小扰动调整</p>
          <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm text-center">
            <div className="text-5xl mb-4">☁️</div>
            <p className="text-gray-500 mb-6">尚未触发事件。点击下方按钮模拟「Day 3 下雨」。</p>
            <button
              onClick={handleTrigger}
              disabled={triggering || !tripId}
              className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {triggering ? 'Agent 正在重规划...' : '⚡ 触发 Day 3 下雨事件'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const originalDayPlan = replanDiff.original_day_plans?.[0];
  const newDayPlans = replanDiff.new_day_plans || [];

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
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm opacity-60 grayscale-[0.3]">
                <div className="flex justify-between items-center mb-8">
                  <div className="font-black text-gray-800">
                    Day {originalDayPlan?.day || '-'} · {originalDayPlan?.city || '-'}
                  </div>
                  <span className="text-[10px] text-gray-400">🌧 降雨概率 90%</span>
                </div>
                <div className="space-y-4">
                  {originalDayPlan ? (['morning', 'noon', 'evening'] as const).map(slot => {
                    const block = originalDayPlan[slot];
                    if (!block?.title) return null;
                    return (
                      <div key={slot} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                        <div className="text-[10px] font-black text-gray-400 w-12">{block.time}</div>
                        <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <span>{iconFor(block.kind, block.is_indoor)}</span> {block.title}
                        </div>
                      </div>
                    );
                  }) : <div className="text-xs text-gray-400">无数据</div>}
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
                {newDayPlans.map((dp: any, idx: number) => {
                  const isCompensation = idx > 0;
                  return (
                    <div key={dp.day} className={idx === 0 ? '' : 'mt-8 pt-8 border-t border-dashed border-gray-200'}>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`text-[10px] font-black uppercase tracking-widest ${isCompensation ? 'text-blue-600' : 'text-gray-900'}`}>
                          Day {dp.day} {isCompensation ? '(调整)' : ''} · {dp.city}
                        </div>
                        {isCompensation && (
                          <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">补偿机制触发</span>
                        )}
                      </div>
                      <div className="space-y-4">
                        {(['morning', 'noon', 'evening'] as const).map(slot => {
                          const block = dp[slot];
                          if (!block?.title) return null;
                          const bg = isCompensation ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100';
                          const bar = isCompensation ? 'bg-blue-500' : 'bg-green-500';
                          const timeColor = isCompensation ? 'text-blue-600' : 'text-green-600';
                          return (
                            <div key={slot} className={`p-5 ${bg} rounded-2xl border flex items-center gap-4 relative`}>
                              <div className={`text-[10px] font-black w-12 ${timeColor}`}>{block.time}</div>
                              <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <span>{iconFor(block.kind, block.is_indoor)}</span> {block.title}
                              </div>
                              <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 ${bar} rounded-full`}></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
                  <span className="text-2xl font-black text-blue-600">
                    {newScore ?? '—'}<span className="text-xs font-normal text-gray-300 ml-1">/100</span>
                  </span>
                </div>
                {(() => {
                  const s = tripData?.scores;
                  const os = replanDiff?.old_score;
                  const rows = [
                    { label: '整体满意度 S_avg', val: s?.S_avg, old: os?.S_avg },
                    { label: '最低满意度 S_min', val: s?.S_min, old: os?.S_min },
                    { label: '行程可行性 F', val: s?.F, old: os?.F },
                    { label: '公平性 Fairness', val: s?.Fairness, old: os?.Fairness }
                  ];
                  return (
                    <div className="space-y-2">
                      {rows.map(item => {
                        const inc = (item.val ?? 0) - (item.old ?? 0);
                        return (
                          <div key={item.label} className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-bold">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-gray-700">{item.val ?? '—'}</span>
                              {item.old !== undefined && (
                                <span className={`text-[8px] font-black flex items-center ${inc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {inc >= 0 ? '↑' : '↓'} {Math.abs(inc)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {oldScore !== undefined && newScore !== undefined && oldScore !== newScore && (
                  <div className="text-[10px] text-gray-400 text-right pt-2">
                    原评分 {oldScore} → {newScore}
                  </div>
                )}
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
