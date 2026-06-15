import { lazy, Suspense, useState, useEffect } from 'react'
import {
  FileText, LayoutDashboard, CreditCard, List, LogOut, Sun, Moon, TrendingUp,
} from 'lucide-react'
import { authApi } from './api/client'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AccountsManager from './components/AccountsManager'
import RecordsManager from './components/RecordsManager'
import { Button } from "@/components/ui/button"

const TrendsDashboard = lazy(() => import('./components/TrendsDashboard'))

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [backendConnected, setBackendConnected] = useState(true)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // On mount, verify token still valid
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    authApi.me()
      .then((r) => {
        setUser(r.data)
        setBackendConnected(true)
      })
      .catch(() => {
        localStorage.removeItem('token')
        setBackendConnected(false)
      })
      .finally(() => setLoading(false))
  }, [])

  // Periodically check backend API health
  useEffect(() => {
    if (!user) return
    const checkHealth = () => {
      authApi.me()
        .then(() => setBackendConnected(true))
        .catch(() => setBackendConnected(false))
    }
    const interval = setInterval(checkHealth, 15000)
    return () => clearInterval(interval)
  }, [user])

  const handleLogin = (userData) => {
    setUser(userData)
    setBackendConnected(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
        {/* Background radial gradients for loading screen */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none animate-ambient-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none animate-ambient-2" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

        <div className="flex flex-col items-center space-y-4 relative z-10">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center animate-bounce shadow-xl shadow-blue-500/20">
            <FileText className="text-white" size={26} />
          </div>
          <div className="text-zinc-400 text-xs animate-pulse font-semibold tracking-wider">安全加载中...</div>
        </div>
      </div>
    )
  }

  if (!user) return <Login onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />

  const navItems = [
    { key: 'dashboard', label: '总览面板', icon: LayoutDashboard },
    { key: 'trends',    label: '趋势看板', icon: TrendingUp },
    { key: 'accounts',  label: '账号与充值', icon: CreditCard },
    { key: 'records',   label: '账单流水',  icon: List },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100 relative">
      {/* Background radial gradients for premium feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none animate-ambient-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none animate-ambient-2" />
      {/* SaaS background grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-65 pointer-events-none" />

      {/* Sidebar (desktop) */}
      <aside className="w-64 bg-zinc-900/35 backdrop-blur-xl border-r border-zinc-900/80 flex-col hidden md:flex z-10 relative">
        <div className="h-20 flex items-center px-6 border-b border-zinc-900/50 justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <FileText className="text-white" size={18} />
            </div>
            <span className="text-[15px] font-bold text-zinc-100 tracking-wider bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-300">
              AI 额度记账
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              id="desktop-theme-toggle"
              type="button"
              aria-label="切换白天和黑夜主题"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200"
              title="切换主题"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div
              className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
                backendConnected
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
              } animate-breathe`}
              title={backendConnected ? "服务连接正常" : "服务连接中断"}
            />
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-semibold relative overflow-hidden group ${
                  isActive
                    ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_0_12px_rgba(59,130,246,0.08)]'
                    : 'text-zinc-400 border border-transparent hover:bg-zinc-800/30 hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-md shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                )}
                <Icon size={17} className={`${isActive ? 'text-blue-400 text-shadow-glow-blue' : 'text-zinc-500 group-hover:text-zinc-400'} transition-colors duration-200`} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-zinc-900/50 bg-zinc-950/20">
          <div className="flex items-center space-x-3 px-2.5 py-2 mb-3 bg-zinc-900/40 rounded-xl border border-zinc-900/60 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold uppercase text-xs shadow-inner">
              {user.username.charAt(0)}
            </div>
            <span className="text-xs font-bold text-zinc-300 truncate">{user.username}</span>
          </div>
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full flex items-center justify-center space-x-2 rounded-xl py-5 text-xs font-bold"
          >
            <LogOut size={13} />
            <span>退出系统</span>
          </Button>
        </div>
      </aside>

      {/* Bottom nav (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/85 backdrop-blur-xl border-t border-zinc-900/80 flex justify-around p-2.5 z-40 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.6)]">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex flex-col items-center py-1 transition-all duration-300 relative ${
                isActive ? 'text-blue-400' : 'text-zinc-500'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
              <Icon size={18} className={isActive ? 'scale-110 text-shadow-glow-blue' : ''} />
              <span className="text-[10px] mt-1 font-semibold">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-24 md:pb-0 relative z-10">
        {/* Mobile header */}
        <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 md:hidden p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white" size={16} />
            </div>
            <span className="text-sm font-bold text-zinc-100">AI 额度记账</span>
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${
                backendConnected
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
              } animate-breathe`}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="mobile-theme-toggle"
              type="button"
              aria-label="切换白天和黑夜主题"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg bg-zinc-900/40 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200"
              title="切换主题"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <Button
              id="mobile-logout-btn"
              onClick={handleLogout}
              variant="ghost"
              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-8 px-2 flex items-center space-x-1 text-xs"
            >
              <LogOut size={13} />
              <span>退出</span>
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full relative">
          <div className="animate-in" key={activeTab}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'trends'    && (
              <Suspense fallback={
                <div className="flex items-center justify-center py-32 text-sm text-zinc-400">
                  <TrendingUp size={18} className="mr-2 animate-pulse text-blue-500" />
                  正在加载趋势看板...
                </div>
              }>
                <TrendsDashboard />
              </Suspense>
            )}
            {activeTab === 'accounts'  && <AccountsManager onTabChange={setActiveTab} />}
            {activeTab === 'records'   && <RecordsManager />}
          </div>
        </div>
      </main>
    </div>
  )
}
