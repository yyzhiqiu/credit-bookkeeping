import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const highlights = [
  '多账号额度统一管理',
  '自动计算周期消耗',
  '账单与趋势清晰可查',
]

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setSuccess('')
    setUsername('')
    setPassword('')
    setConfirm('')
    setShowPassword(false)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await authApi.login(username, password)
      localStorage.setItem('token', response.data.access_token)
      const me = await authApi.me()
      onLogin(me.data)
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    if (password.length < 6) {
      setError('密码长度不能少于 6 位')
      return
    }
    setLoading(true)
    try {
      await authApi.register(username, password)
      setSuccess('注册成功，请使用新账号登录')
      setTimeout(() => switchMode('login'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const inputClassName = 'h-11 rounded-xl border-zinc-800 bg-zinc-950/55 px-3 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/15 dark:bg-zinc-950/45'

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-70" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-indigo-500/10 blur-[130px]" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <FileText size={19} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-zinc-100">AI 额度记账</p>
            <p className="text-[10px] font-medium tracking-[0.18em] text-zinc-500">CREDIT LEDGER</p>
          </div>
        </div>

        {onToggleTheme && (
          <button
            id="login-theme-toggle"
            type="button"
            aria-label={theme === 'dark' ? '切换至浅色主题' : '切换至深色主题'}
            onClick={onToggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-400 shadow-sm backdrop-blur-xl transition hover:border-zinc-700 hover:text-zinc-100"
            title="切换主题"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-7xl items-center gap-12 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:pb-20">
        <section className="animate-in hidden lg:block">
          <div className="mb-8 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400">
              <Sparkles size={13} />
              让每一份额度都有迹可循
            </div>
            <h1 className="text-5xl font-bold leading-[1.12] tracking-[-0.04em] text-zinc-100">
              更从容地掌握
              <br />
              每个账号的额度。
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">
              把分散的账号、周期和扣减记录放进一个清晰的工作台，
              随时知道额度花在哪里、还剩多少。
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-[1fr_0.82fr] gap-4">
            <Card className="border border-zinc-800/80 bg-zinc-900/65 py-0 shadow-2xl shadow-black/10 backdrop-blur-xl">
              <CardContent className="p-5">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">本周期剩余额度</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-100">72.4%</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <BarChart3 size={17} />
                  </div>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full w-[72.4%] rounded-full bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.55)]" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>已使用 27.6%</span>
                  <span>7 天后重置</span>
                </div>
                <div className="mt-6 border-t border-zinc-800/80 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <RefreshCw size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">周期状态正常</p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">刚刚完成自动核算</p>
                      </div>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-zinc-800/80 bg-zinc-900/45 py-0 backdrop-blur-xl">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <ShieldCheck size={19} />
                </div>
                <div className="space-y-3 py-6">
                  {highlights.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] leading-4 text-zinc-500">数据隔离存储，只属于你的账本。</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[430px] animate-in">
          <div className="mb-7 lg:hidden">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400">
              <Sparkles size={13} />
              清晰掌握每一份额度
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
              {mode === 'login' ? '欢迎回来' : '创建你的账本'}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {mode === 'login' ? '登录后继续管理你的账号与额度。' : '几秒钟完成注册，开始记录额度。'}
            </p>
          </div>

          <Card className="gap-0 rounded-[24px] border border-zinc-800/80 bg-zinc-900/80 py-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-7 hidden lg:block">
                <p className="text-2xl font-bold tracking-tight text-zinc-100">
                  {mode === 'login' ? '欢迎回来' : '创建你的账本'}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {mode === 'login' ? '输入账号信息，继续管理你的额度。' : '几秒钟完成注册，开始记录额度。'}
                </p>
              </div>

              <div className="mb-6 grid grid-cols-2 rounded-xl bg-zinc-950/60 p-1 ring-1 ring-zinc-800/80">
                {[
                  { value: 'login', label: '登录' },
                  { value: 'register', label: '注册' },
                ].map((item) => (
                  <button
                    key={item.value}
                    id={`${item.value}-tab-btn`}
                    type="button"
                    aria-label={`切换至${item.label}界面`}
                    aria-pressed={mode === item.value}
                    onClick={() => switchMode(item.value)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                      mode === item.value
                        ? 'bg-zinc-900 text-zinc-100 shadow-sm ring-1 ring-zinc-800'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {error && (
                <div role="alert" className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-400">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div role="status" className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-500">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${mode}-username`} className="text-xs font-semibold text-zinc-300">用户名</Label>
                  <Input
                    id={`${mode}-username`}
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder={mode === 'login' ? '请输入用户名' : '设置你的用户名'}
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${mode}-password`} className="text-xs font-semibold text-zinc-300">
                    {mode === 'login' ? '密码' : '密码（至少 6 位）'}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${mode}-password`}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={mode === 'register' ? 6 : undefined}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      placeholder={mode === 'login' ? '请输入密码' : '设置登录密码'}
                      className={`${inputClassName} pr-10`}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800/70 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-xs font-semibold text-zinc-300">确认密码</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="再次输入密码"
                      className={inputClassName}
                    />
                  </div>
                )}

                <Button
                  id={mode === 'login' ? 'login-submit-btn' : 'reg-submit-btn'}
                  type="submit"
                  aria-label={mode === 'login' ? '提交登录表单' : '提交注册表单'}
                  disabled={loading}
                  className="mt-2 h-11 w-full rounded-xl bg-blue-600 font-semibold text-white shadow-lg shadow-blue-500/15 hover:bg-blue-500"
                >
                  <span>{loading ? (mode === 'login' ? '正在登录...' : '正在创建...') : (mode === 'login' ? '进入工作台' : '创建账号')}</span>
                  {!loading && <ArrowRight size={15} />}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-zinc-800/70 pt-5 text-[11px] text-zinc-500">
                <ShieldCheck size={13} />
                <span>独立账号空间 · 安全数据隔离</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
