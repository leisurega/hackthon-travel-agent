import React, { useState } from 'react';
import { useTrip } from '../contexts/TripContext';

const Profiles: React.FC = () => {
  const [activeUser, setActiveUser] = useState('A');
  const { tripData } = useTrip();

  const currentUser = tripData?.profiles?.find((p: any) => p.user_id === activeUser) || {
    display_name: activeUser + " 用户",
    role: activeUser === 'A' ? "主导成员" : "成员",
    trip_goal: ["放松", "美食"],
    hard_constraints: { budget_cap: 12000, diet: ["无"], daily_walk_km_max: 8, latest_rest_time: "23:30" },
    radar: [80, 60, 70, 50, 40, 60],
    completeness: 82
  };

  const indicators = [
    { name: '放松', max: 100 },
    { name: '美食', max: 100 },
    { name: '摄影', max: 100 },
    { name: '博物馆', max: 100 },
    { name: '购物', max: 100 },
    { name: '深度文化', max: 100 }
  ];

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左侧成员列表 */}
      <div className="w-72 border-r bg-white p-6">
        <h2 className="text-lg font-bold mb-6 text-gray-800">成员列表</h2>
        <div className="space-y-3">
          {['A', 'B', 'C', 'D'].map(user => (
            <div 
              key={user} 
              onClick={() => setActiveUser(user)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                activeUser === user 
                ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' 
                : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  activeUser === user ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {user}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-800">{user} 用户</div>
                  <div className="text-[10px] text-gray-400">完成度 {user === 'A' ? '82%' : user === 'B' ? '76%' : user === 'C' ? '64%' : '58%'}</div>
                </div>
              </div>
              {activeUser === user && <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>}
            </div>
          ))}
        </div>
      </div>
      
      {/* 右侧主内容 */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{currentUser.display_name}</h1>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">{currentUser.role}</span>
              </div>
              <p className="text-gray-400 text-sm mt-2">最后更新：2026-04-24 14:32</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-blue-600 text-sm font-bold border-2 border-blue-100 rounded-xl hover:bg-blue-50 transition-colors">
              <span>✏️</span> 编辑模式
            </button>
          </div>
          
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-8">
              {/* 1. 旅行目标 */}
              <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold mb-5 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 1. 旅行目标
                </h3>
                <div className="flex flex-wrap gap-3">
                  {['放松', '美食', '摄影', '博物馆', '购物', '深度文化'].map(tag => (
                    <span 
                      key={tag} 
                      className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                        currentUser.trip_goal?.includes(tag) 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                        : 'bg-gray-50 text-gray-400 border border-gray-100'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4 italic">选择本次旅行最重要的目标（可多选）</p>
              </section>
              
              {/* 2. 硬约束 */}
              <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold mb-5 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 2. 硬约束
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <span>💰</span> 预算上限
                    </div>
                    <div className="text-lg font-bold text-gray-800">{currentUser.hard_constraints?.budget_cap?.toLocaleString()} CNY</div>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <span>🥗</span> 饮食禁忌
                    </div>
                    <div className="text-lg font-bold text-gray-800">{currentUser.hard_constraints?.diet?.join('、') || '无'}</div>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <span>🚶‍♂️</span> 日均步行上限
                    </div>
                    <div className="text-lg font-bold text-gray-800">{currentUser.hard_constraints?.daily_walk_km_max} km</div>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      <span>🌙</span> 最晚休息时间
                    </div>
                    <div className="text-lg font-bold text-gray-800">{currentUser.hard_constraints?.latest_rest_time}</div>
                  </div>
                </div>
              </section>

              {/* 3. 强偏好 */}
              <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-base font-bold mb-5 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 3. 强偏好
                </h3>
                <div className="space-y-6">
                  {[
                    { label: '城市漫步', value: currentUser.strong_preferences?.city_walking || 85, left: '不重要', right: '非常重要' },
                    { label: '博物馆', value: currentUser.strong_preferences?.museum || 60, left: '不重要', right: '非常重要' },
                    { label: '拍照时段', value: currentUser.strong_preferences?.photography_golden_hour || 95, left: '白天为主', right: '日出/日落优先' },
                    { label: '自由活动', value: currentUser.strong_preferences?.free_time || 70, left: '不喜欢', right: '非常喜欢' }
                  ].map(pref => (
                    <div key={pref.label}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-700">{pref.label}</span>
                        <span className="text-xs text-blue-600 font-bold">{pref.value}%</span>
                      </div>
                      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="absolute h-full bg-blue-600 rounded-full" style={{ width: `${pref.value}%` }}></div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-400">{pref.left}</span>
                        <span className="text-[10px] text-gray-400">{pref.right}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="col-span-4 space-y-8">
              <section className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm sticky top-0">
                <h3 className="text-base font-bold mb-6 text-gray-800">画像摘要</h3>
                <div className="aspect-square mb-8">
                  <RadarChart data={currentUser.radar} indicators={indicators} />
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">关键标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {(currentUser.key_tags || ['放松导向', '摄影偏好', '预算敏感']).map((tag: string) => (
                        <span key={tag} className="px-3 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-100">{tag}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">画像完整度</h4>
                      <span className="text-xl font-bold text-green-500">{currentUser.completeness || 82}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full" style={{ width: `${currentUser.completeness || 82}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                      ℹ️ 画像越完整，Agent 理解越准确，生成的方案越贴合大家真实需求。
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center">
            <button className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all">
              下一步：生成冲突分析 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profiles;
