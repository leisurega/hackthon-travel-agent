import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTrip } from '../contexts/TripContext';
import { tripApi } from '../api/trip';

const SLOT_META: { key: 'morning' | 'noon' | 'evening'; label: string; defaultIcon: string }[] = [
  { key: 'morning', label: '早', defaultIcon: '🌅' },
  { key: 'noon', label: '中', defaultIcon: '🍽' },
  { key: 'evening', label: '晚', defaultIcon: '🌆' },
];

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

const ProposalDetail: React.FC = () => {
  const { tripId, tripData, refreshTrip } = useTrip();
  const navigate = useNavigate();
  const [replanning, setReplanning] = useState(false);

  const handleReplan = async () => {
    if (!tripId) return;
    setReplanning(true);
    try {
      await tripApi.replan(tripId);
      await refreshTrip();
      alert('重新规划完成！');
    } catch (err) {
      console.error('Replan failed', err);
      alert('重新规划失败');
    } finally {
      setReplanning(false);
    }
  };

  const proposal = tripData?.proposal || {
    type: "公平优先",
    cities: [],
    total_budget: 0,
    per_person_budget: 0,
    per_person_per_day: 0,
    recommendation_reasons: [],
    city_days: [],
    per_day: []
  };

  const perUserImpact = tripData?.explanations?.per_user_impact || [];
  const days = tripData?.days || proposal.per_day?.length || 7;
  const perDay = proposal.per_day || [];
  const cityDaysText = proposal.city_days?.map((d: number) => `${d}天`).join(' / ') || '-';

  const roleLabel = (uid: string) => {
    switch (uid) {
      case 'A': return '慢游拍照';
      case 'B': return '博物馆深度';
      case 'C': return '预算控制';
      case 'D': return '购物自由';
      default: return uid;
    }
  };

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">方案详情</h1>
            <p className="text-gray-500 font-medium">{proposal.type}方案 · {proposal.cities?.join(' / ') || '—'} · {days} 天</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleReplan}
              disabled={replanning}
              className="px-6 py-3 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>✏️</span> {replanning ? '规划中...' : '重新规划路径'}
            </button>
            <Link 
              to="/replan"
              className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>✅</span> 采纳此方案
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-8 space-y-8">
            <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="grid grid-cols-4 gap-8 mb-10">
                <div className="col-span-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">总分 ℹ️</div>
                  <div className="text-4xl font-black text-blue-600">{tripData?.scores?.final || 84}<span className="text-sm font-normal text-gray-300 ml-1">/100</span></div>
                  <div className="text-[10px] text-green-500 font-bold mt-1">优秀方案</div>
                </div>
                <div className="col-span-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">预算概览</div>
                  <div className="text-xl font-bold text-gray-800">{proposal.total_budget?.toLocaleString()} CNY</div>
                  <div className="text-[10px] text-gray-400 mt-1">人均预算 {proposal.per_person_budget?.toLocaleString()}</div>
                </div>
                <div className="col-span-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">城市组合</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {proposal.cities?.map((c: string) => (
                      <span key={c} className="px-2 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-100">{c}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">{cityDaysText}</div>
                </div>
                <div className="col-span-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">推荐理由</div>
                  <div className="space-y-1 mt-1">
                    {proposal.recommendation_reasons?.slice(0, 2).map((r: string) => (
                      <div key={r} className="text-[10px] text-gray-600 flex items-center gap-1">
                        <span className="text-green-500">✓</span> {r}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            
            <section className="space-y-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 rounded-full"></span> 每日安排
              </h3>
              {perDay.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 text-sm text-gray-400">方案生成中...</div>
              ) : perDay.map((dayPlan: any) => (
                <div key={dayPlan.day} className="flex gap-6 group">
                  <div className="w-14 flex flex-col items-center pt-2">
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Day</div>
                    <div className="text-2xl font-black text-gray-900">{dayPlan.day}</div>
                    <div className="w-px h-full bg-gray-200 mt-2 group-last:hidden"></div>
                  </div>
                  <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 group-hover:border-blue-100 transition-colors">
                    <div className="flex justify-between items-center mb-5">
                      <h4 className="font-bold text-gray-800">{dayPlan.theme || '-'}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <span>📍</span> {dayPlan.city || '-'}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {SLOT_META.map(slot => {
                        const block = dayPlan[slot.key] || {};
                        const users: string[] = block.beneficiaries || [];
                        return (
                          <div key={slot.key} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">
                              {slot.label}{block.time ? ` · ${block.time}` : ''}
                            </div>
                            <div className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                              <span>{iconFor(block.kind, block.is_indoor) || slot.defaultIcon}</span>
                              <span className="truncate" title={block.title}>{block.title || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-1.5">
                                {users.length === 0 ? (
                                  <div className="text-[10px] text-gray-300">无受益人</div>
                                ) : users.map((u: string) => (
                                  <div key={u} className="w-5 h-5 rounded-full bg-blue-100 border-2 border-white text-[8px] font-bold text-blue-600 flex items-center justify-center shadow-sm">{u}</div>
                                ))}
                              </div>
                              {typeof block.cost === 'number' && block.cost > 0 && (
                                <span className="text-[9px] font-bold text-gray-400">¥{block.cost}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
          
          <div className="col-span-4 space-y-8">
            <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm sticky top-10">
              <h3 className="text-base font-bold mb-8 text-gray-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 成员影响
              </h3>
              <div className="space-y-8">
                {perUserImpact.length === 0 ? (
                  <div className="text-xs text-gray-400">等待评分与解释...</div>
                ) : perUserImpact.map((impact: any) => (
                  <div key={impact.user_id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{impact.user_id}</div>
                        <span className="text-xs font-bold text-gray-700">{roleLabel(impact.user_id)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">满意度</span>
                        <span className="text-sm font-black text-green-500">{impact.satisfaction}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      </div>
                    </div>
                    <div className="space-y-2 pl-10">
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-blue-500 mr-1">满足点：</span> {impact.met?.[0] || '—'}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-orange-500 mr-1">妥协点：</span> {impact.gave_up?.[0] || '—'}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-green-500 mr-1">补偿点：</span> {impact.compensation?.[0] || '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {perUserImpact.length > 0 && (
                <div className="mt-10 pt-8 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    🤝 妥协与补偿记录
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      const g = perUserImpact.find((i: any) => i.gave_up?.[0]);
                      const c = perUserImpact.find((i: any) => i.compensation?.[0]);
                      return (
                        <>
                          {g && (
                            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center">{g.user_id}</div>
                                  <span className="text-[10px] font-bold text-orange-700 uppercase">妥协记录</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-orange-800 leading-relaxed font-medium">{g.gave_up[0]}</p>
                            </div>
                          )}
                          {c && (
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">{c.user_id}</div>
                                  <span className="text-[10px] font-bold text-blue-700 uppercase">补偿记录</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-blue-800 leading-relaxed font-medium">{c.compensation[0]}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetail;
