import React from 'react';

const ProposalDetail: React.FC = () => {
  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">方案详情</h1>
          <p className="text-gray-500">公平优先方案 · 巴黎 / 佛罗伦萨 / 罗马 · 7 天</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border rounded-lg text-sm font-medium">请求调整</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">采纳此方案</button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section className="bg-white p-6 rounded-xl border shadow-sm">
            <div className="flex gap-8 mb-8">
              <div>
                <div className="text-xs text-gray-400 mb-1">总分</div>
                <div className="text-3xl font-bold text-blue-600">84<span className="text-sm font-normal text-gray-400">/100</span></div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">预算概览</div>
                <div className="text-xl font-bold">40,000 CNY</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">城市组合</div>
                <div className="flex gap-1 mt-1">
                  {['巴黎', '佛罗伦萨', '罗马'].map(c => <span key={c} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{c}</span>)}
                </div>
              </div>
            </div>
            
            <h3 className="font-bold mb-4 text-sm">推荐理由</h3>
            <ul className="grid grid-cols-2 gap-2">
              {['满足核心偏好，冲突较少', '日程节奏适中，体验丰富', '预算控制良好，性价比高', '公平指数高 (0.82)'].map(r => (
                <li key={r} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="text-green-500">✓</span> {r}
                </li>
              ))}
            </ul>
          </section>
          
          <section className="space-y-4">
            <h3 className="font-bold">每日安排</h3>
            {[1, 2, 3].map(day => (
              <div key={day} className="flex gap-4">
                <div className="w-12 text-center py-2">
                  <div className="text-xs text-gray-400 uppercase">Day</div>
                  <div className="text-xl font-bold">{day}</div>
                </div>
                <div className="flex-1 bg-white p-4 rounded-xl border shadow-sm">
                  <div className="font-bold text-sm mb-3">抵达巴黎，初识浪漫之都</div>
                  <div className="grid grid-cols-3 gap-3">
                    {['早', '中', '晚'].map(time => (
                      <div key={time} className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-[10px] text-gray-400 mb-1">{time}</div>
                        <div className="text-xs font-bold mb-1">奥赛博物馆</div>
                        <div className="flex gap-1">
                          <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">A</span>
                          <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">B</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
        
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold mb-4 text-sm">成员影响</h3>
            <div className="space-y-4">
              {['A', 'B', 'C', 'D'].map(user => (
                <div key={user} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium">{user} 用户</span>
                    <span className="text-xs font-bold text-green-600">88%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: '88%' }}></div>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    <span className="text-blue-500">满足点：</span> 博物馆行程充足...
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <section className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold mb-4 text-sm">妥协与补偿记录</h3>
            <div className="space-y-3">
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-[10px] font-bold text-orange-600 mb-1">B 妥协</div>
                <p className="text-[10px] text-gray-600">放弃了 1 个完整博物馆日，换取 Day 4 摄影黄金时段</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProposalDetail;
