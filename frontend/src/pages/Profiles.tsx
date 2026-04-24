import React from 'react';

const Profiles: React.FC = () => {
  return (
    <div className="flex h-full">
      {/* 左侧成员列表 */}
      <div className="w-64 border-r bg-gray-50 p-4">
        <h2 className="font-bold mb-4">成员列表</h2>
        <div className="space-y-2">
          {['A', 'B', 'C', 'D'].map(user => (
            <div key={user} className={`p-3 rounded-lg border bg-white flex items-center justify-between cursor-pointer ${user === 'A' ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{user}</div>
                <span className="text-sm font-medium">{user} 用户</span>
              </div>
              <span className="text-xs text-gray-400">82%</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 右侧主内容 */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold">A 用户 <span className="text-sm font-normal bg-blue-100 text-blue-600 px-2 py-0.5 rounded ml-2">主导成员</span></h1>
            <p className="text-gray-400 text-sm mt-1">最后更新：2026-04-24 14:32</p>
          </div>
          <button className="text-blue-600 text-sm border border-blue-600 px-3 py-1 rounded-md">编辑模式</button>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <section className="bg-white p-5 rounded-xl border shadow-sm">
              <h3 className="font-bold mb-3 text-sm">1. 旅行目标</h3>
              <div className="flex flex-wrap gap-2">
                {['放松', '美食', '摄影', '博物馆', '购物', '深度文化'].map(tag => (
                  <span key={tag} className={`px-3 py-1 rounded-full text-xs border ${['放松', '美食', '摄影'].includes(tag) ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-gray-400 border-gray-100'}`}>{tag}</span>
                ))}
              </div>
            </section>
            
            <section className="bg-white p-5 rounded-xl border shadow-sm">
              <h3 className="font-bold mb-3 text-sm">2. 硬约束</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">预算上限</div>
                  <div className="font-bold">12,000 CNY</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">饮食禁忌</div>
                  <div className="font-bold">不吃香菜</div>
                </div>
              </div>
            </section>
          </div>
          
          <div className="space-y-6">
            <section className="bg-white p-5 rounded-xl border shadow-sm">
              <h3 className="font-bold mb-3 text-sm">画像摘要</h3>
              <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                [雷达图占位]
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profiles;
