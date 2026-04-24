import React from 'react';

const TripCreate: React.FC = () => {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">创建新的多人旅行任务</h1>
      <p className="text-gray-500 mb-8">从多个个人 Agent 画像中生成协同旅行方案</p>
      
      <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">旅行名称 *</label>
          <input type="text" className="w-full p-2 border rounded-md" placeholder="例如：意大利与法国浪漫之旅" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">天数 *</label>
            <input type="number" className="w-full p-2 border rounded-md" defaultValue={7} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">总预算 *</label>
            <input type="number" className="w-full p-2 border rounded-md" defaultValue={40000} />
          </div>
        </div>
        
        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          下一步：邀请成员
        </button>
      </div>
    </div>
  );
};

export default TripCreate;
