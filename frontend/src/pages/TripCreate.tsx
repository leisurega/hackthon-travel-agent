import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripApi, profileApi } from '../api/trip';
import { useTrip } from '../contexts/TripContext';

const MemberMultiSelect: React.FC<{
  availableProfiles: any[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}> = ({ availableProfiles, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleId = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    onChange(newIds);
  };

  const selectedProfiles = availableProfiles.filter(p => selectedIds.includes(p.user_id));

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">邀请成员 *</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer flex flex-wrap gap-2 items-center min-h-[50px] hover:border-blue-200 transition-all"
      >
        {selectedProfiles.length > 0 ? (
          selectedProfiles.map(p => (
            <span key={p.user_id} className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-lg flex items-center gap-1">
              {p.display_name}
              <button 
                onClick={(e) => { e.stopPropagation(); toggleId(p.user_id); }}
                className="hover:text-blue-800"
              >
                ✕
              </button>
            </span>
          ))
        ) : (
          <span className="text-gray-400 text-sm">请选择参与成员...</span>
        )}
        <span className="ml-auto text-gray-400">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-64 overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {availableProfiles.map(p => (
            <div 
              key={p.user_id}
              onClick={() => toggleId(p.user_id)}
              className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                selectedIds.includes(p.user_id) ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedIds.includes(p.user_id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {p.user_id[0]}
                </div>
                <div>
                  <div className="text-sm font-bold">{p.display_name}</div>
                  <div className="text-[10px] opacity-60">{p.role}</div>
                </div>
              </div>
              {selectedIds.includes(p.user_id) && <span className="text-blue-600 font-bold">✓</span>}
            </div>
          ))}
          {availableProfiles.length === 0 && (
            <div className="p-4 text-center text-gray-400 text-sm">池中暂无成员</div>
          )}
        </div>
      )}
    </div>
  );
};

const TripCreate: React.FC = () => {
  const navigate = useNavigate();
  const { setTripId, setTripData, selectedMemberIds, setSelectedMemberIds } = useTrip();
  
  const [formData, setFormData] = useState({
    title: '国内多城深度游',
    days: 7,
    budget_total: 30000,
    cities: '北京, 上海, 杭州'
  });
  
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    profileApi.list().then(setAvailableProfiles).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!formData.title || selectedMemberIds.length < 2) {
      alert('请填写标题并至少选择 2 名成员');
      return;
    }
    
    setLoading(true);
    try {
      const cities = formData.cities.split(',').map(c => c.trim()).filter(c => c);
      const res = await tripApi.createTrip({
        ...formData,
        cities,
        member_ids: selectedMemberIds
      });
      
      setTripId(res.trip_id);
      setTripData(res);
      navigate('/conflicts');
    } catch (err) {
      console.error('Failed to create trip', err);
      alert('创建失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">创建新的多人旅行任务</h1>
      <p className="text-gray-500 mb-8">从多个个人 Agent 画像中生成协同旅行方案</p>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-600 rounded-full"></span> 基本信息
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">旅行名称 *</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              placeholder="例如：国内多城深度游" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">天数 *</label>
              <input 
                type="number" 
                value={formData.days}
                onChange={e => setFormData({...formData, days: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">总预算 (CNY) *</label>
              <input 
                type="number" 
                value={formData.budget_total}
                onChange={e => setFormData({...formData, budget_total: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">目的地 (逗号分隔)</label>
            <input 
              type="text" 
              value={formData.cities}
              onChange={e => setFormData({...formData, cities: e.target.value})}
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              placeholder="北京, 上海, 杭州" 
            />
          </div>

          <MemberMultiSelect 
            availableProfiles={availableProfiles}
            selectedIds={selectedMemberIds}
            onChange={setSelectedMemberIds}
          />
          <div className="flex justify-end">
            <Link to="/members" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
              管理成员池画像 →
            </Link>
          </div>
        </div>

        <button 
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] disabled:bg-gray-300 transition-all"
        >
          {loading ? 'Agent 正在规划中 (约 10-20s)...' : '🚀 开始路径规划'}
        </button>
      </div>

      <p className="text-[10px] text-gray-400 mt-6 text-center leading-relaxed">
        💡 Agent 将根据所选成员的画像进行多维冲突分析并生成最优方案。
      </p>
    </div>
  );
};

export default TripCreate;
