import React, { useEffect, useMemo, useState } from 'react';
import { useTrip } from '../contexts/TripContext';
import { humanizeMemberRefs } from '../utils/humanizeMemberRefs';

const PHASE_META: Record<string, { label: string; icon: string; color: string }> = {
  profile: { label: '画像', icon: '👤', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  conflict: { label: '冲突', icon: '⚡', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  keyword: { label: '关键词', icon: 'K', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  pool: { label: 'POI池', icon: 'P', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  supplement: { label: '反思补充', icon: 'R', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  generator: { label: '方案生成', icon: '🧭', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  evaluator: { label: '评估打分', icon: 'E', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  time_fixer: { label: '时间修复', icon: 'T', color: 'text-violet-600 bg-violet-50 border-violet-200' },
  explainer: { label: '解释', icon: '💡', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  replanner: { label: '重排', icon: '🔄', color: 'text-pink-600 bg-pink-50 border-pink-200' },
  rescorer: { label: '复评', icon: '🧮', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
};

const FALLBACK_PHASE = { label: '系统', icon: '🤖', color: 'text-gray-600 bg-gray-50 border-gray-200' };

interface ParsedTrace {
  raw: string;
  phase: string;
  meta: { label: string; icon: string; color: string };
  message: string;
  elapsedMs?: number;
}

const PHASE_RE = /^\[(\w+)\]\s*(.*?)(?:\s*\((\d+)ms\))?$/;

const parseTrace = (raw: string): ParsedTrace => {
  const match = raw.match(PHASE_RE);
  if (!match) {
    return { raw, phase: 'system', meta: FALLBACK_PHASE, message: raw };
  }
  const phase = match[1];
  const message = match[2] || raw;
  const elapsedMs = match[3] ? Number(match[3]) : undefined;
  return {
    raw,
    phase,
    meta: PHASE_META[phase] || FALLBACK_PHASE,
    message,
    elapsedMs,
  };
};

const AgentTracePanel: React.FC = () => {
  const { tripData, loading } = useTrip();
  const [open, setOpen] = useState(true);
  const [autoOpenedFor, setAutoOpenedFor] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const profileById = useMemo(
    () => Object.fromEntries((tripData?.profiles || []).map((p: any) => [p.user_id, p])),
    [tripData?.profiles]
  );

  const traces = useMemo<ParsedTrace[]>(() => {
    const list: string[] = tripData?.agent_trace || [];
    return list.map((raw) => {
      const t = parseTrace(raw);
      return { ...t, message: humanizeMemberRefs(t.message, profileById) };
    });
  }, [tripData?.agent_trace, profileById]);

  // Handle dragging
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };
    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, dragStart]);

  // Auto-open the panel the first time we receive trace for a new trip.
  useEffect(() => {
    const tripId = tripData?.trip_id;
    if (tripId && traces.length > 0 && autoOpenedFor !== tripId) {
      setOpen(true);
      setAutoOpenedFor(tripId);
    }
  }, [tripData?.trip_id, traces.length, autoOpenedFor]);

  if (!tripData) return null;

  const totalElapsed = traces.reduce((sum, t) => sum + (t.elapsedMs || 0), 0);
  const lastPhase = traces.length > 0 ? traces[traces.length - 1].phase : null;

  return (
    <div 
      className="fixed z-50 font-sans"
      style={{ 
        bottom: open ? 'auto' : '24px', 
        right: open ? 'auto' : '24px',
        left: open ? `calc(100vw - 408px + ${position.x}px)` : 'auto',
        top: open ? `calc(100vh - 500px + ${position.y}px)` : 'auto'
      }}
    >
      {open ? (
        <div className="w-96 max-h-[60vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div 
            onMouseDown={onMouseDown}
            className="drag-handle flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-move"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <span className="text-base">🧠</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">Agent Trace</div>
                <div className="text-[10px] text-blue-100">
                  {traces.length} 步 · 总耗时 {totalElapsed}ms
                  {loading && <span className="ml-1 animate-pulse">· 进行中</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none px-2"
              aria-label="收起 Agent Trace 面板"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {traces.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">
                暂无 trace。创建任务后会显示 Agent 思考链。
              </div>
            ) : (
              traces.map((t, idx) => {
                const isCurrent = idx === traces.length - 1 && t.phase === lastPhase;
                return (
                  <div
                    key={idx}
                    className={`flex gap-2 p-2.5 rounded-xl border text-xs ${t.meta.color} ${
                      isCurrent ? 'ring-1 ring-offset-1 ring-blue-300' : 'opacity-90'
                    }`}
                  >
                    <div className="text-base leading-none">{t.meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          {t.meta.label}
                        </span>
                        {t.elapsedMs !== undefined && (
                          <span className="text-[10px] font-mono opacity-70">
                            {t.elapsedMs}ms
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] leading-snug text-gray-700 break-words">
                        {t.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          aria-label="展开 Agent Trace 面板"
        >
          <span>🧠</span>
          <span>Agent Trace · {traces.length}</span>
        </button>
      )}
    </div>
  );
};

export default AgentTracePanel;
