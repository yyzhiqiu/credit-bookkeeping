import { useState } from 'react'
import { FileText, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [mode, setMode]         = useState('login')   // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  const switchMode = (m) => {
    setMode(m); setError(''); setSuccess('')
    setUsername(''); setPassword(''); setConfirm('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await authApi.login(username, password)
      localStorage.setItem('token', res.data.access_token)
      const me = await authApi.me()
      onLogin(me.data)
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('两次输入的密码不一致'); return }
    if (password.length < 6)  { setError('密码长度不能少于 6 位'); return }
    setLoading(true)
    try {
      await authApi.register(username, password)
      setSuccess('注册成功！请使用新账号登录')
      setTimeout(() => switchMode('login'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden font-sans bg-grid-pattern">
      {/* Theme Toggle Button */}
      {onToggleTheme && (
        <button
          id="login-theme-toggle"
          type="button"
          aria-label="切换白天和黑夜主题"
          onClick={onToggleTheme}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200 backdrop-blur-sm z-50 shadow-sm"
          title="切换主题"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      )}
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[150px] pointer-events-none animate-ambient-1" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none animate-ambient-2" />

      <div className="relative group/login w-full max-w-md animate-in">
        {/* Glow backdrop behind card */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-500/20 rounded-[22px] blur-xl opacity-40 group-hover/login:opacity-60 transition-opacity duration-500 pointer-events-none" />
        
        <Card className="w-full bg-zinc-900/45 backdrop-blur-xl border border-zinc-800/80 shadow-2xl relative z-10 p-2 rounded-2xl animate-border-glow">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <FileText className="text-white" size={26} />
            </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">AI 额度记账</CardTitle>
          <CardDescription className="text-zinc-400 text-xs mt-1">多账号 · 周期管理 · 逆推重算</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mode Tabs */}
          <div className="flex bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-1 mb-4">
            <button
              id="login-tab-btn"
              type="button"
              aria-label="切换至登录界面"
              onClick={() => switchMode('login')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              登录
            </button>
            <button
              id="register-tab-btn"
              type="button"
              aria-label="切换至注册界面"
              onClick={() => switchMode('register')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              注册
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 bg-rose-950/45 border border-rose-800/40 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle size={15} className="flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-950/45 border border-emerald-800/40 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
              <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Forms */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-username" className="text-xs text-zinc-300 font-medium">用户名</Label>
                <Input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="请输入用户名"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-xs text-zinc-300 font-medium">密码</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11"
                />
              </div>
              <Button
                id="login-submit-btn"
                type="submit"
                aria-label="提交登录表单"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold py-6 text-sm rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200 mt-2"
              >
                {loading ? '安全登录中...' : '进入系统'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-xs text-zinc-300 font-medium">用户名</Label>
                <Input
                  id="reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="设置用户名"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs text-zinc-300 font-medium">密码（至少 6 位）</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="设置密码"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs text-zinc-300 font-medium">确认密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="再次输入密码"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11"
                />
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                注册后即可独立管理自己的账号与记录，数据互相隔离。
              </p>
              <Button
                id="reg-submit-btn"
                type="submit"
                aria-label="提交注册表单"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-zinc-100 font-semibold py-6 text-sm rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-200 mt-2"
              >
                {loading ? '账户创建中...' : '立即注册'}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center border-t border-zinc-800/40 pt-4 mt-2">
          <span className="text-[11px] text-zinc-500">安全防护 · 离线加固</span>
        </CardFooter>
      </Card>
      </div>
    </div>
  )
}
