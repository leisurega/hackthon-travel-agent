import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrip } from '../contexts/TripContext';
import { tripApi } from '../api/trip';
import { humanizeMemberRefs } from '../utils/humanizeMemberRefs';

const SLOT_META: { key: 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'night'; periodLabel: string; defaultIcon: string }[] = [
  { key: 'morning',   periodLabel: '早', defaultIcon: '🌅' },
  { key: 'lunch',     periodLabel: '午', defaultIcon: '🍽' },
  { key: 'afternoon', periodLabel: '下午', defaultIcon: '🚶' },
  { key: 'dinner',    periodLabel: '晚', defaultIcon: '🍜' },
  { key: 'night',     periodLabel: '夜', defaultIcon: '🌃' },
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
  const { tripId, tripData, refreshTrip, setTripData } = useTrip();
  const [replanning, setReplanning] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [activeRationale, setActiveRationale] = useState<string | null>(null);

  const handleReplan = async () => {
    if (!tripId) return;
    setReplanning(true);
    try {
      const next = await tripApi.replan(tripId);
      if (next) setTripData(next);
      else await refreshTrip();
      alert('重新规划完成！');
    } catch (err) {
      console.error('Replan failed', err);
      alert('重新规划失败');
    } finally {
      setReplanning(false);
    }
  };

  const handleAdopt = async () => {
    if (!tripId || adopting) return;
    setAdopting(true);
    try {
      const next = await tripApi.adopt(tripId);
      if (next) setTripData(next);
      else await refreshTrip();
    } catch (err) {
      console.error('Adopt failed', err);
      alert('采纳失败，请稍后重试');
    } finally {
      setAdopting(false);
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

  const evalReport = tripData?.evaluation_report || {};
  const explanations = tripData?.explanations || {};
  const perUserImpact = explanations.per_user_impact || [];
  const tradeOffs = explanations.trade_off_summary || [];
  const days = tripData?.days || proposal.per_day?.length || 7;
  const perDay = proposal.per_day || [];
  const cityDaysText = proposal.city_days?.length > 0 ? proposal.city_days?.map((d: number) => `${d}天`).join(' / ') : '';
  const adoptedAt: string | undefined = tripData?.adopted_at;
  const notRecommended = tripData?.not_recommended;

  const profileById = useMemo(() => Object.fromEntries(
    (tripData?.profiles || []).map((p: any) => [p.user_id, p])
  ), [tripData?.profiles]);

  const poiById = useMemo(() => {
    const map: Record<string, any> = {};
    const pool = tripData?.poi_pool || {};
    Object.values(pool).forEach((cityList: any) => {
      (cityList || []).forEach((poi: any) => {
        if (poi?.poi_id) map[poi.poi_id] = poi;
      });
    });
    return map;
  }, [tripData?.poi_pool]);

  const roleLabel = (uid: string) => {
    const p = profileById[uid];
    if (!p) return uid;
    return p.role_tag || p.display_name || uid;
  };

  const memberInitial = (uid: string) => {
    const name = profileById[uid]?.display_name;
    return (name && name[0]) || uid;
  };

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {notRecommended && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="text-red-800 font-bold">该方案存在硬性违反，不建议直接采纳</div>
                <div className="text-red-600 text-xs mt-0.5">
                  原因: {evalReport.status_reasons?.join('; ') || '综合评分过低或存在红线违反'}
                </div>
              </div>
            </div>
            <div className="text-red-400 text-xs font-bold uppercase tracking-widest px-3 py-1 border border-red-200 rounded-lg">
              Not Recommended
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">方案详情 (V2)</h1>
              {adoptedAt && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  ✓ 已采纳 · {new Date(adoptedAt).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-gray-500 font-medium">{proposal.type}方案 · {proposal.cities?.join(' / ') || '—'} · {days} 天</p>
          </div>
          <div className="flex flex-col items-end gap-2">
          <div className="flex gap-4">
            <button 
              onClick={() => setShowRationale(!showRationale)}
              className={`px-6 py-3 border-2 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                showRationale ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-100 text-amber-600 hover:bg-amber-50'
              }`}
            >
              <span>ℹ️</span> {showRationale ? '隐藏决策依据' : '查看决策依据'}
            </button>
            <button 
              onClick={() => setShowEval(!showEval)}
              className={`px-6 py-3 border-2 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                showEval ? 'bg-blue-600 border-blue-600 text-white' : 'border-blue-100 text-blue-600 hover:bg-blue-50'
              }`}
            >
              <span>📊</span> {showEval ? '隐藏评估面板' : '查看有效性评估'}
            </button>
            <Link
              to="/conflicts"
              className="px-6 py-3 border-2 border-orange-100 text-orange-600 rounded-2xl font-bold hover:bg-orange-50 transition-all flex items-center gap-2"
            >
              <span>⚠️</span> 冲突分析
            </Link>
            <button 
              onClick={handleReplan}
                disabled={replanning}
                className="px-6 py-3 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span>✏️</span> {replanning ? '规划中...' : '重新规划'}
              </button>
            </div>
          </div>
        </div>

        {showRationale && (
          <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-8 rounded-3xl border-2 border-amber-500 shadow-xl shadow-amber-100 space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-amber-800 flex items-center gap-2">
                  <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm">ℹ️</span>
                  方案决策依据 (Rationale)
                </h3>
                <button onClick={() => setShowRationale(false)} className="text-amber-400 hover:text-amber-600 text-2xl">×</button>
              </div>

              <div className="grid grid-cols-3 gap-8">
                {/* 1. 冲突与避让 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 冲突识别与证据
                  </h4>
                  <div className="space-y-2">
                    {tripData?.conflicts_v2?.dimension_conflicts?.map((c: any, i: number) => (
                      <div key={i} className="p-3 bg-orange-50 rounded-xl border border-orange-100 text-[10px]">
                        <div className="font-bold text-orange-800 mb-1">{c.dimension} · {c.tier}</div>
                        <div className="text-orange-700 mb-1">{humanizeMemberRefs(c.summary, profileById)}</div>
                        <div className="text-orange-400 italic">证据: {humanizeMemberRefs(c.evidence || '通用规则', profileById)}</div>
                        {c.suggestion && <div className="text-orange-600 mt-1">建议: {humanizeMemberRefs(c.suggestion, profileById)}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. 关键词推理 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> 搜索关键词推理
                  </h4>
                  <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 text-[10px] text-teal-800 leading-relaxed">
                    {humanizeMemberRefs(tripData?.keywords?.reasoning, profileById) || '基于全员偏好与黑名单自动提取。'}
                  </div>
                </div>

                {/* 3. 权衡总结 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 团队权衡 (Trade-offs)
                  </h4>
                  <div className="space-y-2">
                    {tradeOffs.length === 0 ? (
                      <div className="text-[10px] text-gray-400 p-4 border border-dashed rounded-xl text-center">无明显权衡记录</div>
                    ) : tradeOffs.map((t: string, i: number) => (
                      <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-800">
                        {humanizeMemberRefs(t, profileById)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {showEval && evalReport && (
          <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
            <section className="bg-white p-8 rounded-3xl border-2 border-blue-500 shadow-xl shadow-blue-100 space-y-8">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">系统状态</div>
                    <div className={`px-4 py-1 rounded-full text-sm font-black ${
                      evalReport.status === 'Pass' ? 'bg-green-100 text-green-600' :
                      evalReport.status === 'HumanReview' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {evalReport.status}
                    </div>
                  </div>
                  <div className="h-10 w-px bg-gray-100"></div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">综合评分</div>
                    <div className="text-3xl font-black text-blue-600">{evalReport.final_group_score}</div>
                  </div>
                  <div className="h-10 w-px bg-gray-100"></div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">补偿到位率</div>
                    <div className="text-xl font-bold text-purple-600">{evalReport.compensation_metric?.fulfilled_pct ?? 0}%</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  {['s_avg', 's_min', 'fairness'].map(m => (
                    <div key={m} className="bg-gray-50 px-4 py-2 rounded-xl text-center">
                      <div className="text-[8px] font-bold text-gray-400 uppercase">{m}</div>
                      <div className="text-sm font-bold text-gray-700">{evalReport.metrics?.[m] ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8">
                {/* Drill-down 1: 硬违反 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> 硬违反清单 (Layer A)
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {evalReport.hard_violations?.length === 0 ? (
                      <div className="text-[10px] text-gray-400 p-4 border border-dashed rounded-xl text-center">无硬性红线违反</div>
                    ) : evalReport.hard_violations.map((v: any, i: number) => (
                      <div key={i} className="p-3 bg-red-50 rounded-xl border border-red-100 text-[10px]">
                        <div className="font-bold text-red-700 mb-1">第 {v.day} 天 · {profileById[v.user_id]?.display_name}</div>
                        <div className="text-red-600">
                          {v.actual_km ? `步行 ${v.actual_km}km > 上限 ${v.limit_km}km` : 
                           v.actual_budget ? `预算 ${v.actual_budget} > 上限 ${v.limit_budget}` :
                           `触发忌口: ${v.forbidden_item} (${v.meal})`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drill-down 2: 补偿审计 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> 补偿审计 (Layer B)
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {evalReport.compensation_audit?.length === 0 ? (
                      <div className="text-[10px] text-gray-400 p-4 border border-dashed rounded-xl text-center">无补偿需求触发</div>
                    ) : evalReport.compensation_audit.map((a: any, i: number) => {
                      const prefLabelMap: Record<string, string> = {
                        'photography': '摄影',
                        'museum': '博物馆',
                        'city_walk': '城市漫步',
                        'tea_culture': '茶文化',
                        'foodie': '美食探索',
                        'nature': '自然山水',
                        'shopping': '购物',
                        'west_lake_scenery': '西湖景观',
                        'coffee_time': '咖啡时光',
                        'slow_pace': '慢节奏',
                        'temple_culture': '寺庙文化',
                        'song_dynasty_culture': '南宋文化',
                        'liangzhu_culture': '良渚文化',
                        'historical_architecture': '历史建筑',
                        'clean_hotel': '酒店品质',
                        'easy_transport': '交通便利',
                        'low_pace': '低强度',
                        'budget_saving': '高性价比',
                        'quiet_rest_time': '安静休息'
                      };
                      return (
                        <div key={i} className={`p-3 rounded-xl border text-[10px] ${
                          a.fulfillment === 'fulfilled' ? 'bg-green-50 border-green-100' :
                          a.fulfillment === 'partial' ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'
                        }`}>
                          <div className="flex justify-between mb-1">
                            <span className="font-bold">{profileById[a.user_id]?.display_name}</span>
                            <span className={`font-black uppercase ${
                              a.fulfillment === 'fulfilled' ? 'text-green-600' :
                              a.fulfillment === 'partial' ? 'text-orange-600' : 'text-gray-400'
                            }`}>{a.fulfillment === 'fulfilled' ? '已满足' : a.fulfillment === 'partial' ? '部分满足' : '未满足'}</span>
                          </div>
                          <div className="text-gray-500 mb-1">牺牲偏好: {prefLabelMap[a.missed_strong_preference] || a.missed_strong_preference}</div>
                          <div className="text-blue-600 font-medium">证据: 第 {a.fulfilled_by?.day ?? '?'} 天 {a.fulfilled_by?.title || '未指定活动'}</div>
                          {a.reason && <div className="text-gray-400 mt-1 italic">理由: {humanizeMemberRefs(a.reason, profileById)}</div>}
                          {a.matched_compensation_rule && <div className="text-gray-400 mt-1">规则: {humanizeMemberRefs(a.matched_compensation_rule, profileById)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Drill-down 3: 个人雷达 */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> 满意度明细 (Layer C)
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {evalReport.per_user?.map((u: any) => (
                      <div key={u.user_id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[10px]">
                        <div className="flex justify-between mb-2">
                          <span className="font-bold text-gray-700">{profileById[u.user_id]?.display_name || u.display_name}</span>
                          <span className="font-black text-blue-600">{u.final_satisfaction}</span>
                        </div>
                        <div className="grid grid-cols-6 gap-1 mb-2">
                          {Object.entries(u.dimensions).map(([k, v]: [string, any]) => {
                            const dimLabelMap: Record<string, string> = {
                              'T': '时间', 'B': '预算', 'P': '节奏', 'I': '兴趣', 'F': '饮食', 'S': '社交'
                            };
                            return (
                              <div key={k} className="text-center">
                                <div className="text-[7px] text-gray-400">{dimLabelMap[k] || k}</div>
                                <div className={`font-bold ${v < 60 ? 'text-red-400' : 'text-gray-600'}`}>{v}</div>
                              </div>
                            );
                          })}
                        </div>
                        {u.penalty_details?.map((p: string, i: number) => (
                          <div key={i} className="text-red-400 text-[8px] italic">{humanizeMemberRefs(p, profileById)}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
        
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-8 space-y-8">
            <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="grid grid-cols-4 gap-8 mb-10">
                <div className="col-span-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">总分 ℹ️</div>
                  <div className="text-4xl font-black text-blue-600">{evalReport?.final_group_score || tripData?.scores?.final || '—'}<span className="text-sm font-normal text-gray-300 ml-1">/100</span></div>
                  <div className={`text-[10px] font-bold mt-1 ${evalReport?.status === 'Reject' ? 'text-red-500' : 'text-green-500'}`}>
                    {evalReport?.status || '优秀方案'}
                  </div>
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
              <div className="mb-1">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-600 rounded-full"></span> 每日安排
                </h3>
                <p className="text-[11px] text-gray-400 mt-1 pl-2">
                  卡片之间的空档未单独编排行程，一般为交通、用餐或休整等弹性时间，不代表系统遗漏。
                </p>
              </div>
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
                    <div className="grid grid-cols-5 gap-4">
                      {SLOT_META.map(slot => {
                        const block = dayPlan[slot.key] || {};
                        const users: string[] = block.beneficiaries || [];
                        const poi = block.poi_id ? poiById[block.poi_id] : undefined;
                        return (
                          <div key={slot.key} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold text-gray-500 mb-2">
                              {slot.periodLabel}
                              {block.start_time
                                ? ` ${block.start_time}-${block.end_time}`
                                : block.time
                                  ? ` ${block.time}`
                                  : ''}
                            </div>
                            <div className="text-xs font-bold text-gray-800 mb-3 flex items-start justify-between gap-1.5 group/title">
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <span className="shrink-0 leading-snug">{iconFor(block.kind, block.is_indoor) || slot.defaultIcon}</span>
                                <span className="line-clamp-2 break-words leading-snug" title={block.title}>{block.title || '—'}</span>
                              </div>
                              {block.selection_rationale && (
                                <button 
                                  onClick={() => setActiveRationale(activeRationale === `${dayPlan.day}-${slot.key}` ? null : `${dayPlan.day}-${slot.key}`)}
                                  className="text-[10px] text-gray-300 hover:text-amber-500 transition-colors"
                                  title="查看选择依据"
                                >
                                  ℹ️
                                </button>
                              )}
                            </div>
                            {activeRationale === `${dayPlan.day}-${slot.key}` && (
                              <div className="mb-3 p-2 bg-amber-50 border border-amber-100 rounded-lg text-[9px] text-amber-800 animate-in zoom-in-95 duration-200">
                                {humanizeMemberRefs(block.selection_rationale, profileById)}
                              </div>
                            )}
                            {poi && (
                              <div className="space-y-1 mb-3 text-[10px] text-gray-500">
                                {poi.rating > 0 && (
                                  <div className="flex items-center gap-1" title={`评分 ${poi.rating}/5`}>
                                    <span>⭐</span>
                                    <span className="font-bold text-amber-600">{poi.rating.toFixed(1)}</span>
                                  </div>
                                )}
                                { (poi.avg_cost > 0 || poi.cost_estimate > 0) && (
                                  <div className="flex items-center gap-1" title={`人均 ¥${poi.avg_cost || poi.cost_estimate}`}>
                                    <span>💰</span>
                                    <span className="font-bold text-gray-700">¥{poi.avg_cost || poi.cost_estimate}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-1.5">
                                {users.length === 0 ? (
                                  <div className="text-[10px] text-gray-300">无受益人</div>
                                ) : users.map((u: string) => (
                                  <div
                                    key={u}
                                    title={profileById[u]?.display_name || u}
                                    className="w-5 h-5 rounded-full bg-blue-100 border-2 border-white text-[8px] font-bold text-blue-600 flex items-center justify-center shadow-sm"
                                  >{memberInitial(u)}</div>
                                ))}
                              </div>
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
                <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 成员影响 (V2)
              </h3>
              <div className="space-y-8">
                {perUserImpact.length === 0 ? (
                  <div className="text-xs text-gray-400">等待评分与解释...</div>
                ) : perUserImpact.map((impact: any) => (
                  <div key={impact.user_id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center"
                          title={profileById[impact.user_id]?.display_name || impact.user_id}
                        >{memberInitial(impact.user_id)}</div>
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
                        <span className="font-bold text-blue-500 mr-1">满足点：</span> {humanizeMemberRefs(impact.met?.[0], profileById) || '—'}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-orange-500 mr-1">妥协点：</span> {humanizeMemberRefs(impact.gave_up?.[0], profileById) || '—'}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-green-500 mr-1">补偿点：</span> {humanizeMemberRefs(impact.compensation?.[0], profileById) || '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetail;
