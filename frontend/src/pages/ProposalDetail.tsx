import React from 'react';
import { useTrip } from '../contexts/TripContext';

const ProposalDetail: React.FC = () => {
  const { tripData } = useTrip();

  const proposal = tripData?.proposal || {
    type: "公平优先",
    cities: ["巴黎", "佛罗伦萨", "罗马"],
    total_budget: 40000,
    per_person_budget: 10000,
    per_person_per_day: 1429,
    recommendation_reasons: ['满足核心偏好，冲突较少', '日程节奏适中，体验丰富', '预算控制良好，性价比高', '公平指数高 (0.82)'],
    per_day: []
  };

  const perUserImpact = tripData?.explanations?.per_user_impact || [
    { user_id: 'A', satisfaction: 88, met: ["博物馆丰富，历史与艺术体验充足"], gave_up: ["Day 5 托斯卡纳酒店对我兴致一般"], compensation: ["Day 4 日落拍摄安排满足摄影偏好"] },
    { user_id: 'B', satisfaction: 82, met: ["每天都有深度景点体验"], gave_up: ["放弃 1 个完整博物馆日"], compensation: ["增加佛罗伦萨日落拍摄时段"] },
    { user_id: 'C', satisfaction: 80, met: ["总预算控制良好"], gave_up: ["酒店位置不在市中心"], compensation: ["人均预算下降约 12%"] },
    { user_id: 'D', satisfaction: 86, met: ["节奏合理，留有自由时间"], gave_up: ["行程中部分步行较多"], compensation: ["Day 3 与 Day 5 安排自由时段"] }
  ];

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">方案详情</h1>
            <p className="text-gray-500 font-medium">{proposal.type}方案 · {proposal.cities?.join(' / ')} · {tripData?.days || 7} 天</p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
              <span>✏️</span> 请求调整
            </button>
            <button className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
              <span>✅</span> 采纳此方案
            </button>
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
                  <div className="text-[10px] text-gray-400 mt-1">3天 / 2天 / 2天</div>
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
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <div key={day} className="flex gap-6 group">
                  <div className="w-14 flex flex-col items-center pt-2">
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Day</div>
                    <div className="text-2xl font-black text-gray-900">{day}</div>
                    <div className="w-px h-full bg-gray-200 mt-2 group-last:hidden"></div>
                  </div>
                  <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4 group-hover:border-blue-100 transition-colors">
                    <div className="flex justify-between items-center mb-5">
                      <h4 className="font-bold text-gray-800">{day === 1 ? '抵达巴黎，初识浪漫之都' : day === 2 ? '艺术与历史的交融' : '巴黎的经典与小巷'}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <span>📍</span> {proposal.cities?.[Math.floor((day-1)/3)] || '巴黎'}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { time: '早', title: '卢浮宫参观', icon: '🏛' },
                        { time: '中', title: '杜乐丽花园咖啡馆', icon: '☕️' },
                        { time: '晚', title: '圣母院与老城漫步', icon: '⛪️' }
                      ].map(item => (
                        <div key={item.time} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">{item.time}</div>
                          <div className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                            <span>{item.icon}</span> {item.title}
                          </div>
                          <div className="flex -space-x-1.5">
                            {['A', 'B'].map(u => (
                              <div key={u} className="w-5 h-5 rounded-full bg-blue-100 border-2 border-white text-[8px] font-bold text-blue-600 flex items-center justify-center shadow-sm">{u}</div>
                            ))}
                          </div>
                        </div>
                      ))}
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
                {perUserImpact.map((impact: any) => (
                  <div key={impact.user_id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{impact.user_id}</div>
                        <span className="text-xs font-bold text-gray-700">{impact.user_id === 'A' ? '文化探索者' : impact.user_id === 'B' ? '深度体验者' : impact.user_id === 'C' ? '预算敏感者' : '轻松悠闲者'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">满意度</span>
                        <span className="text-sm font-black text-green-500">{impact.satisfaction}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      </div>
                    </div>
                    <div className="space-y-2 pl-10">
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-blue-500 mr-1">满足点：</span> {impact.met?.[0]}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-orange-500 mr-1">妥协点：</span> {impact.gave_up?.[0]}
                      </div>
                      <div className="text-[10px] text-gray-600 leading-relaxed">
                        <span className="font-bold text-green-500 mr-1">补偿点：</span> {impact.compensation?.[0]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-10 pt-8 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  🤝 妥协与补偿记录
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center">B</div>
                        <span className="text-[10px] font-bold text-orange-700 uppercase">妥协记录</span>
                      </div>
                      <span className="text-[8px] text-orange-400 font-medium">07-15 10:23</span>
                    </div>
                    <p className="text-[10px] text-orange-800 leading-relaxed font-medium">放弃 1 个完整博物馆日，换取 Day 4 摄影黄金时段</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">C</div>
                        <span className="text-[10px] font-bold text-blue-700 uppercase">补偿记录</span>
                      </div>
                      <span className="text-[8px] text-blue-400 font-medium">07-15 10:23</span>
                    </div>
                    <p className="text-[10px] text-blue-800 leading-relaxed font-medium">接受酒店稍远，换取人均预算下降约 12%</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetail;
