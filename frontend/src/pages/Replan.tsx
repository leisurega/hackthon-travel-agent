import React, { useState, useEffect } from 'react';
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
  const { tripData, tripId, refreshTrip, setTripData } = useTrip();
  const [eventTypes, setEventTypes] = useState<any>({});
  const [selectedType, setSelectedType] = useState('');
  const [eventParams, setEventParams] = useState<any>({});
  const [occursOnDay, setOccursOnDay] = useState(1);
  const [todayInfo, setTodayInfo] = useState<any>(null);
  const [triggering, setTriggering] = useState(false);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    tripApi.getEventTypes().then(setEventTypes).catch(console.error);
    if (tripId) {
      tripApi.getToday(tripId).then(info => {
        setTodayInfo(info);
        setOccursOnDay(info.today_index);
      }).catch(console.error);
    }
  }, [tripId]);

  const handleTrigger = async () => {
    if (!tripId || !selectedType) return;
    setTriggering(true);
    try {
      const next = await tripApi.postEvent(tripId, {
        type: selectedType,
        params: eventParams,
        occurs_on_day: occursOnDay
      });
      setTripData(next);
      // Refresh today info in case it changed
      const info = await tripApi.getToday(tripId);
      setTodayInfo(info);
    } catch (err) {
      console.error('Failed to post event', err);
      alert('触发失败');
    } finally {
      setTriggering(false);
    }
  };

  const handleReplay = async () => {
    if (!tripId || !window.confirm('确定要重置回原始方案并清空所有事件吗？')) return;
    setReplaying(true);
    try {
      const next = await tripApi.replay(tripId);
      setTripData(next);
      const info = await tripApi.getToday(tripId);
      setTodayInfo(info);
    } finally {
      setReplaying(false);
    }
  };

  const renderEventForm = () => {
    if (!selectedType || !eventTypes[selectedType]) return null;
    const fields = eventTypes[selectedType].fields;
    return (
      <div className="grid grid-cols-2 gap-4 mt-4 text-left">
        {fields.map((f: any) => (
          <div key={f.name} className={f.type === 'string' ? 'col-span-2' : ''}>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{f.label}</label>
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              placeholder={f.placeholder}
              value={eventParams[f.name] || ''}
              onChange={e => setEventParams({...eventParams, [f.name]: e.target.value})}
              className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
      </div>
    );
  };

  const frozenUntil = todayInfo?.frozen_until || 0;
  const events = tripData?.events || [];
  const replanDiff = tripData?.replan_diff;

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">动态重排</h1>
            <p className="text-gray-500">基于时间锚点增量调整行程方案</p>
          </div>
          {todayInfo && (
            <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase">当前日期</div>
                <div className="text-xl font-black text-blue-600">Day {todayInfo.today_index}</div>
              </div>
              <div className="w-px h-8 bg-gray-100"></div>
              <div className="text-center">
                <div className="text-[10px] font-black text-gray-400 uppercase">已锁定天数</div>
                <div className="text-xl font-black text-gray-400">Day 1..{frozenUntil}</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-10">
          {/* Left: Event Control Panel */}
          <div className="col-span-4 space-y-6">
            <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-1 h-3 bg-blue-600 rounded-full"></span> 触发突发事件
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">事件类型</label>
                  <select 
                    value={selectedType}
                    onChange={e => {
                      setSelectedType(e.target.value);
                      setEventParams({});
                    }}
                    className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none"
                  >
                    <option value="">请选择事件...</option>
                    {Object.entries(eventTypes).map(([k, v]: [string, any]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {selectedType && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">发生日期 (Day)</label>
                    <input 
                      type="number"
                      min={1}
                      max={tripData?.days || 30}
                      value={occursOnDay}
                      onChange={e => setOccursOnDay(parseInt(e.target.value))}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none"
                    />
                    {occursOnDay < todayInfo?.today_index && (
                      <p className="text-[10px] text-orange-500 mt-1">⚠️ 补录历史事件，重排将从 Day {todayInfo.today_index} 开始</p>
                    )}
                  </div>
                )}

                {renderEventForm()}

                <button
                  onClick={handleTrigger}
                  disabled={triggering || !selectedType}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-200 transition-all"
                >
                  {triggering ? 'Agent 正在重排...' : '⚡ 注入事件并重排'}
                </button>
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-1 h-3 bg-gray-400 rounded-full"></span> 事件历史
              </h3>
              <div className="space-y-3">
                {events.length > 0 ? events.map((e: any) => (
                  <div key={e.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 relative">
                    <div className="text-[10px] font-black text-blue-600 mb-1">Day {e.occurs_on_day}</div>
                    <div className="text-xs font-bold text-gray-700">{e.title}</div>
                    <div className="text-[8px] text-gray-400 mt-1">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 text-center py-4">暂无事件记录</p>
                )}
              </div>
              {events.length > 0 && (
                <button 
                  onClick={handleReplay}
                  disabled={replaying}
                  className="w-full mt-6 text-[10px] font-bold text-red-500 hover:underline"
                >
                  {replaying ? '正在重置...' : '↺ 重置回原始方案 (Baseline)'}
                </button>
              )}
            </section>
          </div>

          {/* Right: Proposal View */}
          <div className="col-span-8 space-y-8">
            {replanDiff ? (
              <div className="bg-orange-50 border border-orange-100 p-6 rounded-3xl mb-6 shadow-sm">
                <div className="text-sm font-black text-orange-700 mb-2">最新调整：{replanDiff.event_summary}</div>
                <div className="text-xs text-orange-600 opacity-80">
                  影响范围：{replanDiff.impact_range} · 扰动程度：{replanDiff.disturbance}
                </div>
                <ul className="mt-4 space-y-1">
                  {replanDiff.how_adjusted.map((t: string, i: number) => (
                    <li key={i} className="text-[10px] text-orange-800 flex items-center gap-2">
                      <span className="w-1 h-1 bg-orange-400 rounded-full"></span> {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-6">
              {tripData?.proposal?.per_day.map((day: any) => {
                const isFrozen = day.day <= frozenUntil;
                return (
                  <div 
                    key={day.day} 
                    className={`bg-white p-6 rounded-3xl border shadow-sm transition-all ${
                      isFrozen ? 'opacity-60 border-gray-100' : 'border-blue-200 ring-2 ring-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                          isFrozen ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white'
                        }`}>
                          DAY {day.day}
                        </span>
                        <h3 className="font-black text-gray-800">{day.city} · {day.theme}</h3>
                      </div>
                      {isFrozen && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">已锁定</span>}
                    </div>
                    
                    <div className="grid grid-cols-5 gap-3">
                      {(['morning', 'lunch', 'afternoon', 'dinner', 'night'] as const).map(slot => {
                        const block = day[slot];
                        if (!block?.title) return null;
                        return (
                          <div key={slot} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-2">
                            <div className="text-[8px] font-black text-gray-400">{block.time}</div>
                            <div className="text-[10px] font-bold text-gray-700 leading-tight">
                              {iconFor(block.kind, block.is_indoor)} {block.title}
                            </div>
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
      </div>
    </div>
  );
};

export default Replan;
