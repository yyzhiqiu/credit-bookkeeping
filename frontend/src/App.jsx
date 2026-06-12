import { useState, useEffect } from 'react'
import {
  FileText, LayoutDashboard, CreditCard, List, LogOut,
} from 'lucide-react'
import { authApi } from './api/client'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AccountsManager from './components/AccountsManager'
import RecordsManager from './components/RecordsManager'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  // On mount, verify token still valid
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    authApi.me()
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = (userData) => setUser(userData)

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm animate-pulse">加载中...</div>
      </div>
    )
  }

  if (!user) return <Login onLogin={handleLogin} />

  const navItems = [
    { key: 'dashboard', label: '总览面板', icon: LayoutDashboard },
    { key: 'accounts',  label: '账号与充值', icon: CreditCard },
    { key: 'records',   label: '账单流水',  icon: List },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar (desktop) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex z-10">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white" size={18} />
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">AI 额度记账</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm ${
                activeTab === key
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center space-x-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold uppercase text-sm">
              {user.username.charAt(0)}
            </div>
            <span className="text-sm font-semibold text-slate-700">{user.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
          >
            <LogOut size={16} /><span>退出系统</span>
          </button>
        </div>
      </aside>

      {/* Bottom nav (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-40 pb-safe">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex flex-col items-center py-1 transition-colors ${
              activeTab === key ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] mt-1 font-medium">{label.slice(0, 2)}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {/* Mobile header */}
        <header className="bg-white/80 backdrop-blur-md shadow-sm md:hidden p-4 flex justify-between items-center sticky top-0 z-30 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <FileText className="text-white" size={14} />
            </div>
            <span className="text-base font-bold text-slate-800">AI 额度记账</span>
          </div>
          <button
            onClick={handleLogout}
            title="退出系统"
            className="p-2 text-rose-600 bg-rose-50 rounded-lg flex items-center space-x-1 text-xs font-medium"
          >
            <LogOut size={16} /><span>退出</span>
          </button>
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
          <div className="animate-in" key={activeTab}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'accounts'  && <AccountsManager onTabChange={setActiveTab} />}
            {activeTab === 'records'   && <RecordsManager />}
          </div>
        </div>
      </main>
    </div>
  )
}
