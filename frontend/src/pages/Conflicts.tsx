import React from 'react';
import { Link } from 'react-router-dom';
import { HeatmapChart } from '../components/Charts';
import { useTrip } from '../contexts/TripContext';

const Conflicts: React.FC = () => {
  const { tripData, selectedMemberIds } = useTrip();

  const idToName: Record<string, string> = Object.fromEntries(
    (tripData?.profiles || []).map((p: any) => [p.user_id, p.display_name])
  );

  const replaceUserIds = (text: string) => {
    if (!text) return text;
    let out = text;
    Object.entries(idToName).forEach(([id, name]) => {
      // 替换 "A 用户" 这种格式
      out = out.replace(new RegExp(`${id}\\s*用户`, 'g'), name);
      // 替换独立的 "A"（前后非字母数字，或者在字符串首尾）
      out = out.replace(new RegExp(`(?<![a-zA-Z0-9])${id}(?![a-zA-Z0-9])`, 'g'), name);
    });
    return out;
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    'Pass': { label: '通过', color: 'green' },
    'Conditional': { label: '有条件通过', color: 'orange' },
    'Reject': { label: '不可行', color: 'red' }
  };
  const currentStatus = statusMap[tripData?.conflicts_v2?.feasibility_status || 'Pass'] || { label: '未知', color: 'gray' };

  const hardConflicts = (tripData?.conflicts || []).filter((c: any) => c.is_hard || c.severity === '高');

  const stats = [
    { label: '总冲突数', value: tripData?.conflict_summary?.total || 0, color: 'blue' },
    { 
      label: '硬冲突', 
      value: tripData?.conflict_summary?.hard || 0, 
      color: 'red',
      details: hardConflicts.map((c: any) => ({
        type: c.type,
        title: replaceUserIds(c.title)
      }))
    },
    { label: '状态', value: currentStatus.label, color: currentStatus.color },
    { label: '系统压力', value: '6维矩阵', color: 'green' }
  ];

  // 动态 X 轴：仅显示选中的成员
  const xAxis = selectedMemberIds.map(id => idToName[id] || id);
  const yAxis = ['T(时间)', 'B(预算)', 'P(节奏)', 'I(兴趣)', 'F(饮食)', 'S(社交)'];

  // 动态 Heatmap 数据：根据选中的成员 ID 过滤列
  const fullHeatmapData = tripData?.heatmap || [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ];

  // 列顺序按当前 trip 的 profiles 顺序对应矩阵列；不再硬编码 A/B/C/D。
  const profileOrder: string[] = (tripData?.profiles || []).map((p: any) => p.user_id);
  const heatmapData = fullHeatmapData.map((row: number[]) =>
    selectedMemberIds.map((id: string) => {
      const idx = profileOrder.indexOf(id);
      return idx >= 0 && idx < row.length ? row[idx] : 0;
    })
  );

  return (
    <div className="p-10 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">冲突分析</h1>
        <p className="text-gray-500 mb-10">系统已识别成员间的关键差异与潜在冲突 ℹ️</p>
        
        <div className="grid grid-cols-4 gap-6 mb-10">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative group">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <div className={`w-2 h-2 rounded-full bg-${stat.color}-500`}></div>
                {stat.label}
              </div>
              <div className={`text-3xl font-black text-gray-800`}>{stat.value}</div>
              
              {stat.details && stat.details.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white p-4 rounded-xl border border-gray-100 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-3">硬冲突摘要</h5>
                  <div className="space-y-2">
                    {stat.details.slice(0, 5).map((d: any, idx: number) => (
                      <div key={idx} className="flex gap-2 text-[10px] leading-tight text-gray-600">
                        <span className="shrink-0">⚠️</span>
                        <span>{d.title}</span>
                      </div>
                    ))}
                    {stat.details.length > 5 && (
                      <div className="text-[10px] text-gray-400 italic">... 还有 {stat.details.length - 5} 条</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-12 gap-8">
          <section className="col-span-5 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-base font-bold mb-8 text-gray-800 flex items-center justify-between">
              冲突热力矩阵 ℹ️
              <div className="flex gap-3 text-[10px] font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-100 border border-slate-200"></span>无</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-200"></span>低</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>中</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600"></span>高</span>
              </div>
            </h3>
            <div className="aspect-square">
              <HeatmapChart data={heatmapData} xAxis={xAxis} yAxis={yAxis} />
            </div>
            <div className="mt-6 space-y-2">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                <b>行</b>：六维画像张力；<b>列</b>：当前成员；<b>格子</b>：该成员在该维度的相对冲突压力。
              </p>
              <p className="text-[10px] text-gray-400">色阶越深，冲突越强。悬浮显示「成员：档位」，数字为 0–3（与图例对应）。</p>
              <p className="text-[10px] text-gray-400 font-medium">档位与右侧冲突卡严重度同源（深红=硬需求 / 中红=强软 / 浅红=弱软 / 近白=无）。</p>
            </div>
          </section>
          
          <section className="col-span-7 space-y-4">
            <h3 className="text-base font-bold mb-4 text-gray-800">关键冲突列表</h3>
            <div className="space-y-4">
              {(tripData?.conflicts || []).map((conflict: any, i: number) => (
                <div key={conflict.conflict_id || i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                    conflict.severity === '高' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
                  }`}>
                    {conflict.type === '节奏冲突' ? '⚡️' : conflict.type === '预算冲突' ? '💰' : conflict.type === '时间冲突' ? '⏰' : '🍴'}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-800">{replaceUserIds(conflict.title)}</h4>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                        conflict.severity === '高' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>{conflict.severity || '高'}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      💡 {replaceUserIds(conflict.suggestion)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {(conflict.users || []).map((u: string) => (
                          <div 
                            key={u} 
                            title={idToName[u] || u}
                            className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white text-[10px] font-bold text-white flex items-center justify-center shadow-sm cursor-help"
                          >
                            {(idToName[u] || u)[0]}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium ml-2">冲突类型：{conflict.type || '风格偏好'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!tripData?.conflicts || tripData.conflicts.length === 0) && (
                <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400 text-sm">
                  暂无明显冲突，行程规划非常顺畅 ✨
                </div>
              )}
            </div>
          </section>
        </div>
        
        <div className="mt-12 flex justify-center gap-4">
          <Link 
            to="/"
            className="px-8 py-4 border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
          >
            ← 返回旅行任务
          </Link>
          <Link 
            to="/proposal"
            className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            查看推荐方案 →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Conflicts;
