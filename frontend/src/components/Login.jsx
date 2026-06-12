import { useState } from 'react'
import { FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authApi } from '../api/client'

export default function Login({ onLogin }) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <FileText className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AI 额度记账</h1>
          <p className="text-sm text-slate-500 mt-1">多账号 · 周期管理 · 逆推重算</p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          {[['login', '登录'], ['register', '注册']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center space-x-2 text-rose-700 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" /><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center space-x-2 text-emerald-700 text-sm">
            <CheckCircle2 size={16} className="flex-shrink-0" /><span>{success}</span>
          </div>
        )}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                required autoFocus placeholder="admin"
                className="form-input py-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required placeholder="••••••••"
                className="form-input py-3" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md shadow-blue-200">
              {loading ? '登录中...' : '进入系统'}
            </button>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                required autoFocus placeholder="设置用户名"
                className="form-input py-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密码（至少 6 位）</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required placeholder="设置密码"
                className="form-input py-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">确认密码</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                required placeholder="再次输入密码"
                className="form-input py-3" />
            </div>
            <p className="text-xs text-slate-400">注册后即可独立管理自己的账号与记录，数据互相隔离。</p>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all shadow-md shadow-emerald-200">
              {loading ? '注册中...' : '立即注册'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
