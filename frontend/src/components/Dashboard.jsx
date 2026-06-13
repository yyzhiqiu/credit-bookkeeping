import { useState, useEffect } from 'react'
import { LayoutDashboard, CreditCard, List, AlertCircle, RefreshCw, Play, Key, CheckCircle2 } from 'lucide-react'
import { accountsApi, recordsApi } from '../api/client'
import Select from './Select'

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v)

function Toast({ msg }) {
  if (!msg.text) return null
  return (
    <div className={`fixed top-4 right-4 p-4 rounded-xl flex items-center space-x-2 z-50 shadow-lg ${msg.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
      {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="font-medium text-sm">{msg.text}</span>
    </div>
  )
}

const formatSeconds = (sec) => {
  if (sec === null || sec === undefined) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

const getResetCalendarTime = (seconds) => {
  if (seconds === null || seconds === undefined || seconds <= 0) return ''
  const targetDate = new Date(Date.now() + seconds * 1000)
  const hours = String(targetDate.getHours()).padStart(2, '0')
  const minutes = String(targetDate.getMinutes()).padStart(2, '0')
  
  const now = new Date()
  const isToday = now.getDate() === targetDate.getDate() && now.getMonth() === targetDate.getMonth() && now.getFullYear() === targetDate.getFullYear()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = tomorrow.getDate() === targetDate.getDate() && tomorrow.getMonth() === targetDate.getMonth() && tomorrow.getFullYear() === targetDate.getFullYear()

  if (isToday) {
    return `今天 ${hours}:${minutes}`
  } else if (isTomorrow) {
    return `明天 ${hours}:${minutes}`
  } else {
    const month = targetDate.getMonth() + 1
    const date = targetDate.getDate()
    return `${month}月${date}日 ${hours}:${minutes}`
  }
}

const formatTokenExpiry = (expiryStr) => {
  if (!expiryStr) return null
  const expiryDate = new Date(expiryStr)
  const diffMs = expiryDate - Date.now()
  if (diffMs <= 0) return <span className="text-rose-500 font-bold">已过期</span>
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  const year = expiryDate.getFullYear()
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0')
  const date = String(expiryDate.getDate()).padStart(2, '0')
  const hours = String(expiryDate.getHours()).padStart(2, '0')
  const minutes = String(expiryDate.getMinutes()).padStart(2, '0')
  const formattedDate = `${year}-${month}-${date} ${hours}:${minutes}`

  let remainingText = ''
  if (diffDays > 0) {
    remainingText = `剩 ${diffDays} 天`
  } else {
    remainingText = `剩 ${diffHours} 小时`
  }
  
  return (
    <span className="text-slate-500">
      {formattedDate} <span className="text-blue-600 font-medium font-sans">({remainingText})</span>
    </span>
  )
}

const buildWeekOptions = (weeksCount, currentWeekNum) => {
  const maxWeek = Math.max(weeksCount, currentWeekNum + 2)
  return Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => ({
    value: w,
    label: w > weeksCount ? `第 ${w} 周（超配置）` : `第 ${w} 周`,
  }))
}

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [msg, setMsg]       = useState({ text: '', type: '' })

  // Real-time Quotas State
  const [liveQuotas, setLiveQuotas] = useState({})
  
  // Token inline updates
  const [tokenUpdateAccId, setTokenUpdateAccId] = useState(null)
  const [newTokenValue, setNewTokenValue] = useState('')

  // Sync Modal State
  const [syncModalData, setSyncModalData] = useState(null)

  const flash = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await accountsApi.dashboard()
      setData(res.data)
    } catch {
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const fetchQuotaForAccount = async (accountId, force = false) => {
    setLiveQuotas(prev => ({
      ...prev,
      [accountId]: { loading: true, error: '', isUnauthorized: false, data: null }
    }))
    try {
      const res = await accountsApi.fetchBalance(accountId, force)
      setLiveQuotas(prev => ({
        ...prev,
        [accountId]: { loading: false, error: '', isUnauthorized: false, data: res.data }
      }))
    } catch (err) {
      const errMsg = err.response?.data?.detail || '获取失败，请检查Token'
      const isUnauthorized = err.response?.status === 401
      setLiveQuotas(prev => ({
        ...prev,
        [accountId]: { loading: false, error: errMsg, isUnauthorized, data: null }
      }))
    }
  }

  const handleOpenSyncModal = (item, remainingVal, typeLabel) => {
    const isResetDetected = remainingVal > item.current_remaining_pct
    const defaultWeek = isResetDetected ? item.current_week_num + 1 : item.current_week_num
    
    setSyncModalData({
      item,
      remainingVal,
      weekNumber: defaultWeek,
      isResetDetected,
      desc: `同步${typeLabel}线上额度`,
    })
  }

  const handleQuickSyncSubmit = async (e) => {
    e.preventDefault()
    if (!syncModalData) return
    const { item, remainingVal, weekNumber, desc } = syncModalData
    const rPct = parseFloat(remainingVal)
    if (isNaN(rPct)) { flash('同步的额度无效', 'error'); return }
    
    // Determine baseline remaining % based on selected week
    const baseline = Number(weekNumber) === item.current_week_num ? item.current_remaining_pct : 100.0
    let cPct = +(baseline - rPct).toFixed(2)
    if (cPct < 0) {
      cPct = 0
    }
    
    try {
      await recordsApi.create({
        account_id: item.account_id,
        week_number: Number(weekNumber),
        remaining_pct: rPct,
        consumed_pct: cPct,
        description: desc,
      })
      flash('对齐同步成功！')
      setSyncModalData(null)
      load() // Reloads dashboard & re-triggers quota fetch
    } catch (err) {
      flash(err.response?.data?.detail || '同步失败', 'error')
    }
  }

  const handleUpdateToken = async (accountId) => {
    if (!newTokenValue.trim()) return
    try {
      const res = await accountsApi.list()
      const acc = res.data.find(a => a.id === accountId)
      if (!acc) throw new Error('Account not found')
      
      await accountsApi.update(accountId, {
        name: acc.name,
        api_type: acc.api_type,
        api_url: acc.api_url,
        api_key: newTokenValue.trim(),
        api_account_id: acc.api_account_id,
      })
      flash('Token 更新成功！')
      setTokenUpdateAccId(null)
      setNewTokenValue('')
      fetchQuotaForAccount(accountId)
    } catch {
      flash('Token 更新失败', 'error')
    }
  }

  useEffect(() => { load() }, [])

  // Auto-fetch real-time quotas when dashboard data is loaded
  useEffect(() => {
    if (!data?.cycles) return
    const apiCycles = data.cycles.filter(c => c.api_type === 'codex')
    apiCycles.forEach(c => {
      fetchQuotaForAccount(c.account_id)
    })
  }, [data])

  if (loading) return <div className="text-slate-400 text-sm py-20 text-center animate-pulse">加载中...</div>
  if (error)   return (
    <div className="flex flex-col items-center py-20 space-y-4">
      <p className="text-rose-500">{error}</p>
      <button onClick={load} className="flex items-center space-x-2 text-blue-600 hover:underline text-sm">
        <RefreshCw size={14} /><span>重新加载</span>
      </button>
    </div>
  )

  const { total_active_accounts, total_budget, total_spent, cycles } = data

  const statCards = [
    { label: '当前活跃账号', value: `${total_active_accounts} 个`, icon: LayoutDashboard, color: 'blue' },
    { label: '活跃周期总预算', value: fmt(total_budget), icon: CreditCard, color: 'emerald' },
    { label: '活跃周期总已用', value: fmt(total_spent), icon: List, color: 'rose' },
  ]

  const colorMap = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-600' },
  }

  return (
    <div className="space-y-6">
      <Toast msg={msg} />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">总览概况</h2>
        <button onClick={load} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className={`p-4 ${colorMap[color].bg} ${colorMap[color].text} rounded-xl`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cycle progress cards */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-base font-semibold text-slate-800 mb-5">各账号当前周期状态</h3>
        {cycles.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">暂无活跃周期，请先创建账号</p>
        ) : (
          <div className="space-y-5">
            {cycles.map((item) => {
              const pct = item.current_consumed_pct
              const barColor = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'
              const isExtraWeek = item.current_week_num > item.weeks_count
              return (
                <div key={item.cycle_id} className="border border-slate-100 p-4 rounded-xl bg-slate-50/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-800">{item.account_name}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                          第 {item.cycle_number} 期
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {isExtraWeek ? (
                          <span className="text-amber-600 font-medium flex items-center">
                            <AlertCircle size={12} className="mr-1" />当前第 {item.current_week_num} 业务周，已超出配置 {item.current_week_num - item.weeks_count} 周
                          </span>
                        ) : `进行至：第 ${item.current_week_num} 业务周 / 配置 ${item.weeks_count} 周`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-slate-500 block">
                        配置周预算: <span className="font-medium text-slate-700">{fmt(item.weekly_budget)}</span>
                      </span>
                      <span className="text-slate-500">
                        本周已用: <span className="font-bold text-rose-600">
                          {fmt(item.current_consumed_amount)}
                        </span> ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs font-medium">
                    <span className="text-emerald-600">本周已记录剩余: {item.current_remaining_pct}%</span>
                    <span className="text-slate-400">100%</span>
                  </div>

                  {/* Codex Real-time Quota Info */}
                  {item.api_type === 'codex' && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      {(() => {
                        const live = liveQuotas[item.account_id]
                        if (!live) return null
                        if (live.loading) {
                          return (
                            <div className="text-xs text-slate-400 animate-pulse flex items-center space-x-1.5 py-1">
                              <RefreshCw size={12} className="animate-spin" />
                              <span>正在拉取 Codex 线上实时额度...</span>
                            </div>
                          )
                        }
                        if (live.error) {
                          return (
                            <div className="text-xs text-rose-500 space-y-1.5 py-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5">
                                  <AlertCircle size={12} />
                                  <span>实时额度获取失败: {live.error}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => fetchQuotaForAccount(item.account_id, true)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-0.5 font-medium"
                                >
                                  <RefreshCw size={10} />
                                  <span>重试</span>
                                </button>
                              </div>
                              {live.isUnauthorized && (
                                <div className="mt-1">
                                  {tokenUpdateAccId === item.account_id ? (
                                    <div className="p-2 bg-white rounded border border-slate-200 space-y-1.5 max-w-sm">
                                      <textarea
                                        value={newTokenValue}
                                        onChange={(e) => setNewTokenValue(e.target.value)}
                                        placeholder="粘贴新 Access Token (ey...)"
                                        rows={2}
                                        className="w-full text-xs font-mono p-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                      <div className="flex justify-end space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setTokenUpdateAccId(null)}
                                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-medium"
                                        >
                                          取消
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateToken(item.account_id)}
                                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium"
                                        >
                                          更新并重试
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => { setTokenUpdateAccId(item.account_id); setNewTokenValue('') }}
                                      className="text-blue-600 hover:text-blue-800 underline font-semibold flex items-center space-x-0.5"
                                    >
                                      <Key size={10} className="mr-0.5" />
                                      <span>快捷更新 Token</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        }
                        if (live.data) {
                          const { primary_remaining_percent, secondary_remaining_percent } = live.data
                          
                          const showDiff = (livePct) => {
                            const diff = +(livePct - item.current_remaining_pct).toFixed(2)
                            if (diff === 0) return <span className="text-slate-400 ml-1.5 font-normal">(已同步)</span>
                            if (diff < 0) return <span className="text-rose-500 ml-1.5 font-semibold">({diff}% 未记录)</span>
                            return <span className="text-emerald-500 ml-1.5 font-semibold">(已重置 +{diff}%)</span>
                          }

                          return (
                            <div className="bg-blue-50/30 border border-blue-100/60 p-2.5 rounded-lg text-xs space-y-2">
                              <div className="flex flex-col gap-0.5 pb-1.5 border-b border-blue-100/40 text-left">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-blue-800">
                                  <div className="flex items-center space-x-1">
                                    <span>Codex 线上实时额度</span>
                                    <button
                                      type="button"
                                      onClick={() => fetchQuotaForAccount(item.account_id, true)}
                                      title="强制刷新（绕过缓存）"
                                      className="p-0.5 text-blue-500 hover:text-blue-700 hover:bg-blue-100/50 rounded transition-colors"
                                    >
                                      <RefreshCw size={11} className={live.loading ? "animate-spin" : ""} />
                                    </button>
                                  </div>
                                  <span>套餐: {live.data.plan_type || 'Pro'}</span>
                                </div>
                                {live.data.token_expires_at && (
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    Token 有效期至: {formatTokenExpiry(live.data.token_expires_at)}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                                {primary_remaining_percent !== null && (
                                  <div className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-100">
                                    <div className="space-y-0.5">
                                      <span className="block font-medium text-slate-500 text-[10px]">5小时额度剩余</span>
                                      <div className="flex items-baseline">
                                        <span className="font-bold text-blue-600 text-sm">
                                          {primary_remaining_percent.toFixed(2)}%
                                        </span>
                                        {showDiff(primary_remaining_percent)}
                                      </div>
                                      {live.data.primary_reset_after_seconds > 0 && (
                                        <span className="block text-[9px] text-amber-600 font-medium leading-none">
                                          刷新: {getResetCalendarTime(live.data.primary_reset_after_seconds)} ({formatSeconds(live.data.primary_reset_after_seconds)}后)
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSyncModal(item, primary_remaining_percent, '5h额度')}
                                      className="bg-blue-600 text-white hover:bg-blue-700 font-bold py-1 px-2 rounded text-[10px] transition-colors"
                                    >
                                      一键同步
                                    </button>
                                  </div>
                                )}
                                {secondary_remaining_percent !== null && (
                                  <div className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-100">
                                    <div className="space-y-0.5">
                                      <span className="block font-medium text-slate-500 text-[10px]">每周额度剩余</span>
                                      <div className="flex items-baseline">
                                        <span className="font-bold text-emerald-600 text-sm">
                                          {secondary_remaining_percent.toFixed(2)}%
                                        </span>
                                        {showDiff(secondary_remaining_percent)}
                                      </div>
                                      {live.data.secondary_reset_after_seconds > 0 && (
                                        <span className="block text-[9px] text-amber-600 font-medium leading-none">
                                          刷新: {getResetCalendarTime(live.data.secondary_reset_after_seconds)} ({formatSeconds(live.data.secondary_reset_after_seconds)}后)
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSyncModal(item, secondary_remaining_percent, '周额度')}
                                      className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold py-1 px-2 rounded text-[10px] transition-colors"
                                    >
                                      一键同步
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sync Modal */}
      {syncModalData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-in text-left">
            <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center">
              <Play className="mr-2 text-blue-600" size={18} />
              同步线上额度并记账
            </h3>
            
            {syncModalData.isResetDetected && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                <p className="font-bold flex items-center">
                  <AlertCircle size={14} className="mr-1" /> 检测到额度已重置/回升
                </p>
                <p>当前线上剩余（{syncModalData.remainingVal.toFixed(2)}%）大于上次记录（{syncModalData.item.current_remaining_pct}%）。系统已为您自动切换至**下一业务周**。</p>
              </div>
            )}
            
            <form onSubmit={handleQuickSyncSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">账号名称</label>
                <input
                  type="text"
                  disabled
                  value={syncModalData.item.account_name}
                  className="form-input bg-slate-50 text-slate-500 cursor-not-allowed text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">线上剩余比例</label>
                  <input
                    type="text"
                    disabled
                    value={`${syncModalData.remainingVal.toFixed(2)}%`}
                    className="form-input bg-slate-50 text-slate-500 cursor-not-allowed font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">业务周</label>
                  <Select
                    value={syncModalData.weekNumber}
                    onChange={(val) => setSyncModalData(prev => ({ ...prev, weekNumber: Number(val) }))}
                    options={buildWeekOptions(syncModalData.item.weeks_count, syncModalData.item.current_week_num)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">消耗事项（核心说明）</label>
                <textarea
                  required
                  value={syncModalData.desc}
                  onChange={(e) => setSyncModalData(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="请输入本次同步的消耗原因，例如：跑批量接口 / 翻译文档"
                  rows={3}
                  className="form-input resize-none text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSyncModalData(null)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm shadow-md"
                >
                  确认同步记账
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
