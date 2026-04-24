import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { TripProvider } from './contexts/TripContext';
import TripCreate from './pages/TripCreate';
import MemberPool from './pages/MemberPool';
import Conflicts from './pages/Conflicts';
import ProposalDetail from './pages/ProposalDetail';
import Replan from './pages/Replan';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', label: '旅行任务', icon: '📋' },
    { path: '/members', label: '成员池', icon: '🗂️' },
    { path: '/conflicts', label: '冲突分析', icon: '⚠️' },
    { path: '/proposal', label: '方案对比', icon: '📊' },
    { path: '/replan', label: '动态重排', icon: '🔄' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* 左侧导航栏 */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">✈️</div>
            <span>多人旅行协同 Agent</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="text-[10px] text-blue-600 font-bold mb-1 uppercase tracking-wider">Personal-Agent-Native</div>
            <p className="text-[10px] text-blue-800 leading-relaxed">让每个人的偏好被理解，让协同决策更轻松。</p>
            <button className="text-[10px] text-blue-600 font-bold mt-2 hover:underline">了解更多 →</button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <header className="h-16 bg-white border-b flex items-center justify-end px-8 gap-4">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">🔍</div>
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm relative">
            🔔 <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">3</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-sm overflow-hidden">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
          </div>
        </header>
        
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TripProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<TripCreate />} />
            <Route path="/members" element={<MemberPool />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/proposal" element={<ProposalDetail />} />
            <Route path="/replan" element={<Replan />} />
          </Routes>
        </Layout>
      </TripProvider>
    </Router>
  );
}

export default App;
