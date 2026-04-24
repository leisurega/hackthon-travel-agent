import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { profileApi } from '../api/trip';

const MemberPool: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfile, setActiveProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const editId = searchParams.get('edit');

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (editId && profiles.length > 0) {
      const p = profiles.find(p => p.user_id === editId);
      if (p) setActiveProfile(JSON.parse(JSON.stringify(p)));
    }
  }, [editId, profiles]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await profileApi.list();
      setProfiles(data);
      if (!editId && data.length > 0) {
        setActiveProfile(JSON.parse(JSON.stringify(data[0])));
      }
    } catch (err) {
      console.error('Failed to load profiles', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!activeProfile) return;
    setSaving(true);
    try {
      await profileApi.update(activeProfile.user_id, activeProfile);
      await loadProfiles();
      alert('保存成功！');
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const newId = `USER_${Date.now()}`;
    const newProfile = {
      user_id: newId,
      display_name: '新成员',
      role: '成员',
      trip_goal: ['放松'],
      hard_constraints: { budget_cap: 10000, diet: [], daily_walk_km_max: 10, latest_rest_time: '23:30' },
      strong_preferences: { city_walking: 50, museum: 50, photography_golden_hour: 50, free_time: 50 },
      anti_preferences: [],
      key_tags: ['新成员'],
      radar: [50, 50, 50, 50, 50, 50],
      completeness: 50
    };
    try {
      await profileApi.create(newProfile);
      await loadProfiles();
      setSearchParams({ edit: newId });
    } catch (err) {
      console.error('Failed to create profile', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除此成员吗？')) return;
    try {
      await profileApi.delete(id);
      await loadProfiles();
      if (editId === id) setSearchParams({});
    } catch (err) {
      console.error('Failed to delete profile', err);
    }
  };

  if (loading) return <div className="p-10">加载中...</div>;

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左侧成员列表 */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">成员画像池</h2>
          <button 
            onClick={handleCreate}
            className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {profiles.map(p => (
            <div 
              key={p.user_id}
              onClick={() => setSearchParams({ edit: p.user_id })}
              className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                activeProfile?.user_id === p.user_id 
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    activeProfile?.user_id === p.user_id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.user_id[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{p.display_name}</div>
                    <div className="text-[10px] text-gray-400">{p.key_tags?.join(' · ')}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.user_id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧编辑表单 */}
      <div className="flex-1 overflow-y-auto p-10">
        {activeProfile ? (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">编辑成员画像</h1>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-300 transition-all"
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">显示名称</label>
                <input 
                  type="text" 
                  value={activeProfile.display_name}
                  onChange={e => setActiveProfile({...activeProfile, display_name: e.target.value})}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">角色</label>
                <select 
                  value={activeProfile.role}
                  onChange={e => setActiveProfile({...activeProfile, role: e.target.value})}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="主导成员">主导成员</option>
                  <option value="成员">成员</option>
                </select>
              </div>
            </div>

            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">1. 旅行目标 (Trip Goals)</h3>
              <div className="flex flex-wrap gap-2">
                {['放松', '美食', '摄影', '博物馆', '购物', '深度文化'].map(goal => (
                  <button
                    key={goal}
                    onClick={() => {
                      const goals = activeProfile.trip_goal || [];
                      const newGoals = goals.includes(goal) ? goals.filter((g: string) => g !== goal) : [...goals, goal];
                      setActiveProfile({...activeProfile, trip_goal: newGoals});
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      activeProfile.trip_goal?.includes(goal)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 text-gray-400 border border-gray-100'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-800">2. 强偏好 (0-100)</h3>
              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                {[
                  { key: 'city_walking', label: '城市漫步' },
                  { key: 'museum', label: '博物馆' },
                  { key: 'photography_golden_hour', label: '拍照时段' },
                  { key: 'free_time', label: '自由活动' }
                ].map(pref => (
                  <div key={pref.key} className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm text-gray-600">{pref.label}</label>
                      <span className="text-sm font-bold text-blue-600">{activeProfile.strong_preferences[pref.key]}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" 
                      value={activeProfile.strong_preferences[pref.key]}
                      onChange={e => setActiveProfile({
                        ...activeProfile, 
                        strong_preferences: {
                          ...activeProfile.strong_preferences,
                          [pref.key]: parseInt(e.target.value)
                        }
                      })}
                      className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">3. 硬约束</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">预算上限 (CNY)</label>
                  <input 
                    type="number" 
                    value={activeProfile.hard_constraints.budget_cap}
                    onChange={e => setActiveProfile({
                      ...activeProfile,
                      hard_constraints: { ...activeProfile.hard_constraints, budget_cap: parseInt(e.target.value) }
                    })}
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">步行上限 (km/day)</label>
                  <input 
                    type="number" 
                    value={activeProfile.hard_constraints.daily_walk_km_max}
                    onChange={e => setActiveProfile({
                      ...activeProfile,
                      hard_constraints: { ...activeProfile.hard_constraints, daily_walk_km_max: parseFloat(e.target.value) }
                    })}
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none"
                  />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            请选择或创建一个成员进行编辑
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberPool;
