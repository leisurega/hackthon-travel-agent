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
      role_tag: '普通成员',
      protection_level: 'medium',
      core_story: '',
      hard_constraints: { budget_max: 5000, walk_km_max: 8.0, dietary: [], latest_rest_time: '23:00' },
      strong_preferences: { photography: 0.5, museum: 0.5, city_walk: 0.5 },
      anti_preferences: {},
      negotiable_range: {},
      scoring_weights: { T: 0.15, B: 0.15, P: 0.2, I: 0.25, F: 0.15, S: 0.1 },
      compensation_preference: []
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

  const updateNested = (path: string, value: any) => {
    const keys = path.split('.');
    const newProfile = { ...activeProfile };
    let current = newProfile;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setActiveProfile(newProfile);
  };

  const removeNestedKey = (path: string, keyToRemove: string) => {
    const newProfile = { ...activeProfile };
    const keys = path.split('.');
    let current = newProfile;
    for (let i = 0; i < keys.length; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      if (i === keys.length - 1) {
        delete current[keys[i]][keyToRemove];
      } else {
        current = current[keys[i]];
      }
    }
    setActiveProfile(newProfile);
  };

  if (loading) return <div className="p-10">加载中...</div>;

  return (
    <div className="flex h-full bg-gray-50">
      {/* 左侧成员列表 */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">成员画像池 (V2)</h2>
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
                    {p.display_name?.[0] || p.user_id[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{p.display_name}</div>
                    <div className="text-[10px] text-gray-400">{p.role_tag || '未设置标签'}</div>
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
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">编辑成员画像</h1>
                <p className="text-sm text-gray-400 mt-1">ID: {activeProfile.user_id}</p>
              </div>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:bg-gray-300 transition-all"
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>

            {/* 基础信息 */}
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
                <label className="text-xs font-bold text-gray-400 uppercase">角色标签</label>
                <input 
                  type="text" 
                  value={activeProfile.role_tag}
                  placeholder="如：西湖摄影慢游型"
                  onChange={e => setActiveProfile({...activeProfile, role_tag: e.target.value})}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">核心故事 / 背景</label>
              <textarea 
                value={activeProfile.core_story}
                onChange={e => setActiveProfile({...activeProfile, core_story: e.target.value})}
                rows={3}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="描述用户的旅行动机、职业背景等..."
              />
            </div>

            {/* 6 维卡片 - P/B/T */}
            <div className="grid grid-cols-3 gap-6">
              {/* P: 节奏与体力 (合并保护等级) */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded flex items-center justify-center text-xs">P</span>
                  节奏与体力
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">保护等级 (优先级)</label>
                    <select 
                      value={activeProfile.protection_level}
                      onChange={e => setActiveProfile({...activeProfile, protection_level: e.target.value})}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none"
                    >
                      <option value="low">体力强 (低保护)</option>
                      <option value="medium">体力中 (中保护)</option>
                      <option value="high">体力弱 (高保护/红线)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">步行上限 (km)</label>
                    <input 
                      type="number" step="0.5"
                      value={activeProfile.hard_constraints.walk_km_max}
                      onChange={e => updateNested('hard_constraints.walk_km_max', parseFloat(e.target.value))}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* B: 预算 */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-100 text-green-600 rounded flex items-center justify-center text-xs">B</span>
                  预算与消费
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">总预算上限 (CNY)</label>
                    <input 
                      type="number"
                      value={activeProfile.hard_constraints.budget_max}
                      onChange={e => updateNested('hard_constraints.budget_max', parseInt(e.target.value))}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* T: 时间 */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs">T</span>
                  时间与作息
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase">最晚回酒店</label>
                    <input 
                      type="time"
                      value={activeProfile.hard_constraints.latest_rest_time}
                      onChange={e => updateNested('hard_constraints.latest_rest_time', e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* S: 社交与自主 */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded flex items-center justify-center text-xs">S</span>
                社交方式与自主空间
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" id="accept_split"
                    checked={activeProfile.negotiable_range?.accept_split_action}
                    onChange={e => updateNested('negotiable_range.accept_split_action', e.target.checked)}
                  />
                  <label htmlFor="accept_split" className="text-sm text-gray-600">接受分头行动</label>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase">独处时间偏好 (0-1)</label>
                  <input 
                    type="range" min="0" max="100" step="10"
                    value={(activeProfile.strong_preferences?.solo_time || 0) * 100}
                    onChange={e => updateNested('strong_preferences.solo_time', parseInt(e.target.value) / 100)}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-yellow-600"
                  />
                </div>
              </div>
            </section>

            {/* I: 兴趣偏好 */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded flex items-center justify-center text-xs">I</span>
                兴趣覆盖 (0.0 - 1.0)
              </h3>
              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                {Object.entries(activeProfile.strong_preferences).map(([key, val]: [string, any]) => {
                  const labelMap: Record<string, string> = {
                    'photography': '摄影',
                    'museum': '博物馆',
                    'city_walk': '城市漫步',
                    'city_walking': '城市漫步',
                    'photography_golden_hour': '黄金时段摄影',
                    'free_time': '自由活动',
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
                    <div key={key} className="space-y-1 group/item relative">
                      <div className="flex justify-between">
                        <label className="text-sm text-gray-600">{labelMap[key] || key}</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-purple-600">{Math.round(val * 100)}%</span>
                          <button 
                            onClick={() => removeNestedKey('strong_preferences', key)}
                            className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="5"
                        value={val * 100}
                        onChange={e => updateNested(`strong_preferences.${key}`, parseInt(e.target.value) / 100)}
                        className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  );
                })}
                <button 
                  onClick={() => {
                    const key = prompt('输入新偏好 key (如: tea_culture)');
                    if (key) updateNested(`strong_preferences.${key}`, 0.5);
                  }}
                  className="text-xs text-purple-600 font-bold hover:underline text-left"
                >
                  + 添加偏好维度
                </button>
              </div>
            </section>

            {/* F: 饮食与健康 */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-red-100 text-red-600 rounded flex items-center justify-center text-xs">F</span>
                饮食与健康安全 (Must Not)
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeProfile.hard_constraints.dietary?.map((item: string, idx: number) => (
                  <div key={idx} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    {item}
                    <button onClick={() => {
                      const newDiet = activeProfile.hard_constraints.dietary.filter((_: any, i: number) => i !== idx);
                      updateNested('hard_constraints.dietary', newDiet);
                    }}>×</button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const item = prompt('输入忌口或过敏项');
                    if (item) updateNested('hard_constraints.dietary', [...(activeProfile.hard_constraints.dietary || []), item]);
                  }}
                  className="px-3 py-1 border border-dashed border-red-200 text-red-400 rounded-lg text-sm"
                >
                  + 添加忌口
                </button>
              </div>
            </section>

            {/* Anti Preferences */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-100 text-gray-600 rounded flex items-center justify-center text-xs">A</span>
                反感项强度 (0.0 - 1.0)
              </h3>
              <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                {Object.entries(activeProfile.anti_preferences || {}).map(([key, val]: [string, any]) => (
                  <div key={key} className="space-y-1 group/item relative">
                    <div className="flex justify-between">
                      <label className="text-sm text-gray-600">{key}</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-600">{Math.round(val * 100)}%</span>
                        <button 
                          onClick={() => removeNestedKey('anti_preferences', key)}
                          className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" min="0" max="100" step="5"
                      value={val * 100}
                      onChange={e => updateNested(`anti_preferences.${key}`, parseInt(e.target.value) / 100)}
                      className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-gray-600"
                    />
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const key = prompt('输入反感项 key (如: crowds)');
                    if (key) updateNested(`anti_preferences.${key}`, 0.5);
                  }}
                  className="text-xs text-gray-600 font-bold hover:underline text-left"
                >
                  + 添加反感维度
                </button>
              </div>
            </section>

            {/* 评分权重 */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">评分权重 (Scoring Weights)</h3>
              <div className="grid grid-cols-6 gap-4">
                {[
                  { key: 'T', label: '时间' },
                  { key: 'B', label: '预算' },
                  { key: 'P', label: '节奏' },
                  { key: 'I', label: '兴趣' },
                  { key: 'F', label: '饮食' },
                  { key: 'S', label: '社交' }
                ].map(dim => (
                  <div key={dim.key} className="space-y-1">
                    <label className="text-xs text-gray-400 block text-center">{dim.label}</label>
                    <input 
                      type="number" step="0.05" min="0" max="1"
                      value={activeProfile.scoring_weights[dim.key]}
                      onChange={e => updateNested(`scoring_weights.${dim.key}`, parseFloat(e.target.value))}
                      className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-center text-sm font-bold"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">注：权重总和应为 1.0，用于计算个人最终满意度。</p>
            </section>

            {/* 补偿偏好 */}
            <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">补偿机制 (Compensation)</h3>
              <div className="space-y-3">
                {activeProfile.compensation_preference?.map((comp: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-start">
                    <div className="text-sm">
                      <div className="font-bold text-gray-700">当 {comp.trigger} 时:</div>
                      <div className="text-blue-600 mt-1">补偿动作: {comp.action}</div>
                    </div>
                    <button onClick={() => {
                      const newComp = activeProfile.compensation_preference.filter((_: any, i: number) => i !== idx);
                      setActiveProfile({...activeProfile, compensation_preference: newComp});
                    }} className="text-gray-300 hover:text-red-500">×</button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const trigger = prompt('触发场景 (如：未拍到日落)');
                    const action = prompt('补偿动作 (如：次日清晨独自西湖摄影 90min)');
                    if (trigger && action) {
                      setActiveProfile({
                        ...activeProfile, 
                        compensation_preference: [...(activeProfile.compensation_preference || []), { trigger, action }]
                      });
                    }
                  }}
                  className="w-full py-3 border border-dashed border-gray-200 text-gray-400 rounded-xl text-sm hover:bg-gray-50 transition-all"
                >
                  + 添加补偿规则
                </button>
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
