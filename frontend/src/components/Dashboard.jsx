import { useState, useEffect } from 'react'
import { LayoutDashboard, CreditCard, List, AlertCircle, RefreshCw, Play, Key, CheckCircle2, Copy } from 'lucide-react'
import { accountsApi, recordsApi } from '../api/client'
import Select from './Select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v)

function Toast({ msg }) {
  if (!msg.text) return null
  return (
    <div className={`fixed top-6 right-6 px-4 py-3 rounded-xl flex items-center space-x-2.5 z-50 shadow-xl border backdrop-blur-md transition-all duration-300 animate-in ${msg.type === 'error' ? 'bg-rose-950/90 border-rose-800/40 text-rose-200' : 'bg-emerald-950/90 border-emerald-800/40 text-emerald-200'}`}>
      {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span className="font-semibold text-xs tracking-wide">{msg.text}</span>
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
  if (diffMs <= 0) return <Badge variant="destructive" className="font-bold">已过期</Badge>
  
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
    <span className="text-zinc-400 font-mono text-[10px]">
      {formattedDate} <span className="text-blue-400 font-semibold">({remainingText})</span>
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

function QuotaSparkline({ cycleId, allRecords, width = 220, height = 36 }) {
  const cycleRecs = allRecords.filter(r => r.cycle_id === cycleId)
  const sortedRecs = [...cycleRecs].sort((a, b) => {
    const weekDiff = Number(a.week_number) - Number(b.week_number)
    return weekDiff || new Date(a.created_at) - new Date(b.created_at)
  })

  const chartValues = [{ percentage: 100, type: 'start' }]
  let previousWeek = null

  sortedRecs.forEach((record) => {
    if (previousWeek !== null && record.week_number !== previousWeek) {
      chartValues.push({
        percentage: 100,
        type: 'reset',
        weekNumber: record.week_number,
      })
    }

    chartValues.push({
      percentage: Number(record.remaining_pct),
      type: 'record',
      weekNumber: record.week_number,
    })
    previousWeek = record.week_number
  })

  if (chartValues.length === 1) {
    chartValues.push({ percentage: 100, type: 'empty' })
  }

  const padding = 2
  const activeWidth = width - padding * 2
  const activeHeight = height - padding * 2

  const points = chartValues.map((value, i) => {
    const safePercentage = Math.min(100, Math.max(0, value.percentage))
    const x = padding + (i / (chartValues.length - 1)) * activeWidth
    const y = padding + (1 - safePercentage / 100) * activeHeight
    return { ...value, x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`

  return (
    <div className="flex flex-col space-y-1 w-full max-w-[260px] shrink-0">
      <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold mb-1 tracking-wider uppercase">
        <span>额度扣减轨迹 (本期)</span>
        <span className="text-blue-400 font-mono">点数: {sortedRecs.length}</span>
      </div>
      <div className="relative" style={{ height }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
          <defs>
            <linearGradient id={`grad-${cycleId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${cycleId})`} />
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_1px_4px_rgba(59,130,246,0.3)]" />
          {points.map((p, idx) => (
            <circle
              key={`${p.type}-${p.weekNumber ?? 0}-${idx}`}
              cx={p.x}
              cy={p.y}
              r={p.type === 'reset' ? 2.5 : 2}
              fill={p.type === 'reset' ? '#3b82f6' : '#ffffff'}
              stroke={p.type === 'reset' ? '#bfdbfe' : '#3b82f6'}
              strokeWidth="1"
              className="hover:r-3 cursor-crosshair transition-all"
              title={p.type === 'reset'
                ? `第 ${p.weekNumber} 周额度重置: 100%`
                : `记录点: ${p.percentage}%`}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [allRecords, setAllRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [msg, setMsg]       = useState({ text: '', type: '' })

  const [liveQuotas, setLiveQuotas] = useState({})
  const [tokenUpdateAccId, setTokenUpdateAccId] = useState(null)
  const [newTokenValue, setNewTokenValue] = useState('')
  const [syncModalData, setSyncModalData] = useState(null)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchItems, setBatchItems] = useState([])
  const [batchScanning, setBatchScanning] = useState(false)

  const flash = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [dashRes, recsRes] = await Promise.all([
        accountsApi.dashboard(),
        recordsApi.list()
      ])
      setData(dashRes.data)
      setAllRecords(recsRes.data)
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
      return res.data
    } catch (err) {
      const errMsg = err.response?.data?.detail || '获取失败，请检查Token'
      const isUnauthorized = err.response?.status === 401
      setLiveQuotas(prev => ({
        ...prev,
        [accountId]: { loading: false, error: errMsg, isUnauthorized, data: null }
      }))
      return null
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
      load()
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

  const handleOpenBatchModal = async () => {
    if (!data?.cycles) return;
    const apiCycles = data.cycles.filter(item => item.api_type === 'codex');
    if (apiCycles.length === 0) {
      flash('当前没有配置线上额度查询的账号', 'error');
      return;
    }

    setBatchScanning(true);
    const quotaResults = await Promise.all(
      apiCycles.map(async item => ({
        accountId: item.account_id,
        data: await fetchQuotaForAccount(item.account_id, true),
      }))
    );
    setBatchScanning(false);

    const quotasByAccount = Object.fromEntries(
      quotaResults
        .filter(result => result.data)
        .map(result => [result.accountId, result.data])
    );
    const items = [];
    apiCycles.forEach(item => {
        const liveData = quotasByAccount[item.account_id];
        if (liveData) {
          const r1 = liveData.primary_remaining_percent;
          const r2 = liveData.secondary_remaining_percent;
          let activeR = r2 !== null ? r2 : r1;
          if (activeR !== null && activeR < item.current_remaining_pct) {
            items.push({
              id: item.account_id,
              name: item.account_name,
              cycle_number: item.cycle_number,
              weeks_count: item.weeks_count,
              week_number: item.current_week_num,
              baseline: item.current_remaining_pct,
              remaining: activeR,
              consumed: +(item.current_remaining_pct - activeR).toFixed(2),
              description: '',
              selected: true,
            });
          } else if (activeR !== null && activeR > item.current_remaining_pct) {
            items.push({
              id: item.account_id,
              name: item.account_name,
              cycle_number: item.cycle_number,
              weeks_count: item.weeks_count,
              week_number: item.current_week_num + 1,
              baseline: 100.0,
              remaining: activeR,
              consumed: +(100.0 - activeR).toFixed(2),
              description: '',
              selected: true,
              isReset: true,
            });
          }
        }
    });
    
    if (items.length === 0) {
      flash('查询完成，当前没有需要对齐记账的额度变动', 'success');
      return;
    }
    setBatchItems(items);
    setShowBatchModal(true);
  }

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const selectedItems = batchItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      flash('请至少选择一个账号进行同步', 'error');
      return;
    }

    const records = selectedItems.map(item => {
      const cPct = parseFloat(item.consumed);
      return {
        account_id: item.id,
        week_number: Number(item.week_number),
        remaining_pct: item.remaining,
        consumed_pct: isNaN(cPct) || cPct < 0 ? 0 : cPct,
        description: item.description,
      };
    });

    try {
      await recordsApi.bulkCreate({ records });
      flash(`成功批量同步了 ${records.length} 个账号的额度！`);
      setShowBatchModal(false);
      load();
    } catch (err) {
      flash(err.response?.data?.detail || '批量同步失败', 'error');
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <RefreshCw className="animate-spin text-blue-500 w-8 h-8" />
        <span className="text-zinc-400 text-sm font-medium animate-pulse">正在获取最新统计指标...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20 space-y-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6">
        <AlertCircle size={32} className="text-rose-500" />
        <p className="text-rose-400 text-sm font-semibold">{error}</p>
        <Button id="dashboard-error-reload-btn" onClick={load} variant="outline" className="border-zinc-800 hover:bg-zinc-800 text-zinc-300" aria-label="错误重试">
          <RefreshCw size={14} className="mr-1.5" />
          <span>重新加载</span>
        </Button>
      </div>
    )
  }

  const { total_active_accounts, total_budget, total_spent, cycles } = data

  const statCards = [
    { label: '活跃账号数量', value: `${total_active_accounts} 个`, icon: LayoutDashboard, gradient: 'from-blue-500/10 to-indigo-500/5', border: 'border-blue-500/20', iconColor: 'text-blue-400' },
    { label: '周期总配额预算', value: fmt(total_budget), icon: CreditCard, gradient: 'from-emerald-500/10 to-teal-500/5', border: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
    { label: '周期总已用额度', value: fmt(total_spent), icon: List, gradient: 'from-rose-500/10 to-pink-500/5', border: 'border-rose-500/20', iconColor: 'text-rose-400' },
  ]

  return (
    <div className="space-y-6">
      <Toast msg={msg} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">总览概况</h2>
          <p className="text-xs text-zinc-400 mt-0.5">监控全局额度预算与线上套餐最新状态</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            id="dashboard-batch-sync-trigger"
            onClick={handleOpenBatchModal}
            disabled={batchScanning}
            className="bg-blue-600 hover:bg-blue-700 text-zinc-100 flex items-center space-x-1 text-xs px-3.5 py-4 rounded-xl shadow-lg shadow-blue-500/10"
            aria-label="集中扫视并批量记账"
          >
            {batchScanning ? <RefreshCw size={14} className="animate-spin" /> : <Copy size={14} />}
            <span>{batchScanning ? '正在查询...' : '集中扫视记账'}</span>
          </Button>
          <Button
            id="dashboard-refresh-btn"
            onClick={load}
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl w-9 h-9 p-0"
            aria-label="刷新全局总览数据"
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, gradient, border, iconColor }) => (
          <Card key={label} className={`bg-zinc-900/30 border ${border} bg-gradient-to-tr ${gradient} backdrop-blur-xl shadow-lg relative group overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-zinc-700/80`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-tr from-transparent to-white/[0.02] opacity-20 rounded-bl-full pointer-events-none transition-all duration-500 group-hover:scale-125" />
            <CardContent className="p-5 flex items-center space-x-4 relative z-10">
              <div className={`p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 ${iconColor} transition-transform duration-300 group-hover:scale-110 shadow-inner`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">{label}</p>
                <p className="text-xl font-extrabold text-zinc-100 mt-1 font-sans">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cycle progress cards */}
      <div className="flex flex-col space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-zinc-100">各账号当前周期状态</h3>
          <p className="text-xs text-zinc-400">显示当前周期各个账号已扣减的额度占比</p>
        </div>
        <div>
          {cycles.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-12">暂无活跃周期，请先前往“账号与充值”创建账号</div>
          ) : (
            <div className="space-y-4.5">
              {cycles.map((item) => {
                const pct = item.current_consumed_pct
                const barColor = pct > 90 
                  ? 'from-rose-500 to-red-600' 
                  : pct > 70 
                    ? 'from-amber-500 to-orange-500' 
                    : 'from-emerald-500 to-blue-500'
                const isExtraWeek = item.current_week_num > item.weeks_count
                return (
                  <div key={item.cycle_id} className="border border-zinc-800/40 p-5 rounded-2xl bg-zinc-900/35 backdrop-blur-md hover:border-zinc-700/60 hover:bg-zinc-900/45 transition-all duration-300 shadow-lg flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 w-full">
                      <div className="flex-1 w-full space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-zinc-100 text-sm">{item.account_name}</span>
                              <Badge className="bg-blue-600/15 text-blue-400 border border-blue-500/20 hover:bg-blue-600/15 py-0 px-2 text-[10px] rounded-full">
                                第 {item.cycle_number} 期
                              </Badge>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1">
                              {isExtraWeek ? (
                                <span className="text-amber-500 font-medium flex items-center">
                                  <AlertCircle size={12} className="mr-1 text-amber-400" />
                                  当前第 {item.current_week_num} 业务周，已超出预设 {item.current_week_num - item.weeks_count} 周
                                </span>
                              ) : `进行至：第 ${item.current_week_num} 业务周 / 配置 ${item.weeks_count} 周`}
                            </p>
                          </div>
                          <div className="flex gap-4 sm:gap-6 mt-2 sm:mt-0">
                            <div className="flex flex-col text-left sm:text-right">
                              <span className="text-[10px] text-zinc-500 font-medium">周配额预算</span>
                              <span className="text-xs font-semibold text-zinc-300 font-mono mt-0.5">{fmt(item.weekly_budget)}</span>
                            </div>
                            <div className="w-px bg-zinc-800/60 my-1 hidden sm:block" />
                            <div className="flex flex-col text-left sm:text-right">
                              <span className="text-[10px] text-zinc-500 font-medium">本周已记用量</span>
                              <div className="flex items-baseline space-x-1 sm:justify-end mt-0.5">
                                <span className="text-xs font-bold text-rose-400 font-mono">{fmt(item.current_consumed_amount)}</span>
                                <span className="text-[9px] text-zinc-500">({pct}%)</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="flex justify-between items-end mb-1.5">
                            <span className="text-[10px] text-zinc-400 font-medium tracking-wide">本地记录额度进度</span>
                            <span className="text-[11px] font-bold text-emerald-400">剩余 {item.current_remaining_pct}%</span>
                          </div>
                          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-900 shadow-inner">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-700 bg-gradient-to-r ${barColor}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <QuotaSparkline cycleId={item.cycle_id} allRecords={allRecords} />
                    </div>

                    {/* Codex Real-time Quota Info */}
                    {item.api_type === 'codex' && (
                      <div className="border-t border-zinc-800/50 pt-3 mt-1">
                        {(() => {
                          const live = liveQuotas[item.account_id]
                          if (!live) {
                            return (
                              <div className="flex items-center justify-between gap-3 py-1">
                                <span className="text-[10px] text-zinc-500">线上额度仅在手动查询时获取</span>
                                <Button
                                  id={`fetch-btn-live-${item.account_id}`}
                                  type="button"
                                  onClick={() => fetchQuotaForAccount(item.account_id, true)}
                                  variant="outline"
                                  className="h-7 px-2.5 text-[10px] border-blue-500/20 bg-blue-500/5 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                  aria-label="手动查询线上实时配额"
                                >
                                  <RefreshCw size={10} className="mr-1" />
                                  查询线上额度
                                </Button>
                              </div>
                            )
                          }
                          if (live.loading) {
                            return (
                              <div className="text-[10px] text-zinc-400 animate-pulse flex items-center space-x-1.5 py-1">
                                <RefreshCw size={12} className="animate-spin text-blue-500" />
                                <span>正在查询 Codex 线上实时配额...</span>
                              </div>
                            )
                          }
                          if (live.error) {
                            return (
                              <div className="text-xs text-rose-400 space-y-1.5 py-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1.5 text-[11px] text-rose-400 font-medium">
                                    <AlertCircle size={12} />
                                    <span className="truncate max-w-[280px] sm:max-w-md">实时配额获取失败: {live.error}</span>
                                  </div>
                                  <Button
                                    id={`refresh-btn-live-${item.account_id}`}
                                    type="button"
                                    onClick={() => fetchQuotaForAccount(item.account_id, true)}
                                    variant="link"
                                    className="text-blue-400 hover:text-blue-300 p-0 h-auto text-[11px] font-semibold flex items-center space-x-0.5"
                                    aria-label="重试获取实时配额"
                                  >
                                    <RefreshCw size={10} />
                                    <span>重试</span>
                                  </Button>
                                </div>
                                {live.isUnauthorized && (
                                  <div className="mt-1 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800 max-w-md">
                                    {tokenUpdateAccId === item.account_id ? (
                                      <div className="space-y-2">
                                        <textarea
                                          id={`edit-token-textarea-${item.account_id}`}
                                          value={newTokenValue}
                                          onChange={(e) => setNewTokenValue(e.target.value)}
                                          placeholder="粘贴新的 Access Token (eyJhbGciOi...)"
                                          rows={2}
                                          className="w-full text-[10px] font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50"
                                        />
                                        <div className="flex justify-end space-x-1.5">
                                          <Button
                                            id={`edit-token-cancel-${item.account_id}`}
                                            type="button"
                                            onClick={() => setTokenUpdateAccId(null)}
                                            variant="ghost"
                                            className="h-7 px-2.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
                                            aria-label="取消Token更新"
                                          >
                                            取消
                                          </Button>
                                          <Button
                                            id={`edit-token-submit-${item.account_id}`}
                                            type="button"
                                            onClick={() => handleUpdateToken(item.account_id)}
                                            className="h-7 px-2.5 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-zinc-100"
                                            aria-label="提交Token更新"
                                          >
                                            更新并重试
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button
                                        id={`edit-token-trigger-${item.account_id}`}
                                        type="button"
                                        onClick={() => { setTokenUpdateAccId(item.account_id); setNewTokenValue('') }}
                                        variant="link"
                                        className="text-blue-400 hover:text-blue-300 p-0 h-auto text-[11px] font-bold"
                                        aria-label="快捷更新 Token 按钮"
                                      >
                                        <Key size={10} className="mr-1" />
                                        <span>更新授权 Token</span>
                                      </Button>
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
                              if (diff === 0) return <span className="text-zinc-500 ml-1.5 font-normal text-[9.5px]">(已对齐)</span>
                              if (diff < 0) return <span className="text-rose-400 ml-1.5 font-semibold text-[9.5px]">({diff}% 未记录)</span>
                              return <span className="text-emerald-400 ml-1.5 font-semibold text-[9.5px]">(已重置 +{diff}%)</span>
                            }

                            const hasBoth = primary_remaining_percent !== null && secondary_remaining_percent !== null

                            return (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-zinc-500 pb-1">
                                  <div className="flex items-center space-x-1.5 text-blue-400/90">
                                    <span>Codex 线上实时配额</span>
                                    <Button
                                      id={`refresh-btn-live-success-${item.account_id}`}
                                      type="button"
                                      onClick={() => fetchQuotaForAccount(item.account_id, true)}
                                      variant="ghost"
                                      title="强制刷新（绕过缓存）"
                                      className="h-5 w-5 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                      aria-label="强制刷新线上实时配额"
                                    >
                                      <RefreshCw size={10} className={live.loading ? "animate-spin" : ""} />
                                    </Button>
                                  </div>
                                  <div className="flex items-center space-x-3 text-[10px] text-zinc-500 font-medium">
                                    <span>套餐: <span className="text-zinc-400 font-semibold">{live.data.plan_type || 'Pro'}</span></span>
                                    {live.data.token_expires_at && (
                                      <span>Token: <span className="text-zinc-400 font-semibold">{formatTokenExpiry(live.data.token_expires_at)}</span></span>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {primary_remaining_percent !== null && (
                                    <div className={`flex justify-between items-center py-2 px-1 ${hasBoth ? 'border-b border-zinc-800/10 sm:border-b-0 sm:border-r sm:border-zinc-800/20 sm:pr-4' : ''}`}>
                                      <div className="space-y-1 text-left">
                                        <div className="flex items-baseline space-x-1.5 flex-wrap">
                                          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">5小时线上额度</span>
                                          <span className="font-extrabold text-blue-400 text-xs sm:text-sm">
                                            {primary_remaining_percent.toFixed(2)}%
                                          </span>
                                          {showDiff(primary_remaining_percent)}
                                        </div>
                                        {live.data.primary_reset_after_seconds > 0 && (
                                          <span className="block text-[9.5px] text-zinc-500 font-medium leading-none">
                                            重置: {getResetCalendarTime(live.data.primary_reset_after_seconds)} ({formatSeconds(live.data.primary_reset_after_seconds)}后)
                                          </span>
                                        )}
                                      </div>
                                      <Button
                                        id={`sync-btn-primary-${item.account_id}`}
                                        type="button"
                                        onClick={() => handleOpenSyncModal(item, primary_remaining_percent, '5h额度')}
                                        className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-zinc-100 font-bold h-7 text-[10px] px-2.5 rounded-lg transition-colors border border-blue-500/20"
                                        aria-label="同步5小时额度"
                                      >
                                        同步
                                      </Button>
                                    </div>
                                  )}
                                  {secondary_remaining_percent !== null && (
                                    <div className={`flex justify-between items-center py-2 px-1 ${hasBoth ? 'sm:pl-4' : ''}`}>
                                      <div className="space-y-1 text-left">
                                        <div className="flex items-baseline space-x-1.5 flex-wrap">
                                          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">每周线上限额</span>
                                          <span className="font-extrabold text-emerald-400 text-xs sm:text-sm">
                                            {secondary_remaining_percent.toFixed(2)}%
                                          </span>
                                          {showDiff(secondary_remaining_percent)}
                                        </div>
                                        {live.data.secondary_reset_after_seconds > 0 && (
                                          <span className="block text-[9.5px] text-zinc-500 font-medium leading-none">
                                            重置: {getResetCalendarTime(live.data.secondary_reset_after_seconds)} ({formatSeconds(live.data.secondary_reset_after_seconds)}后)
                                          </span>
                                        )}
                                      </div>
                                      <Button
                                        id={`sync-btn-secondary-${item.account_id}`}
                                        type="button"
                                        onClick={() => handleOpenSyncModal(item, secondary_remaining_percent, '周额度')}
                                        className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-zinc-100 font-bold h-7 text-[10px] px-2.5 rounded-lg transition-colors border border-emerald-500/20"
                                        aria-label="同步每周限额"
                                      >
                                        同步
                                      </Button>
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
      </div>

      {/* Sync Modal */}
      <Dialog open={!!syncModalData} onOpenChange={(open) => { if (!open) setSyncModalData(null) }}>
        {syncModalData && (
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-100 flex items-center">
                <Play className="mr-2 text-blue-500" size={16} />
                同步线上额度并记账
              </DialogTitle>
            </DialogHeader>
            
            {syncModalData.isResetDetected && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl text-[11px] leading-relaxed space-y-1">
                <p className="font-bold flex items-center">
                  <AlertCircle size={13} className="mr-1.5 text-amber-400" /> 额度已自动重置/回升
                </p>
                <p>当前线上剩余（{syncModalData.remainingVal.toFixed(2)}%）大于上次记录（{syncModalData.item.current_remaining_pct}%）。系统已自动为您递增并切换至**下一业务周**。</p>
              </div>
            )}
            
            <form onSubmit={handleQuickSyncSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">账号名称</Label>
                <Input
                  type="text"
                  disabled
                  value={syncModalData.item.account_name}
                  className="bg-zinc-800/40 border-zinc-800 text-zinc-400 text-sm cursor-not-allowed h-11"
                />
              </div>
              
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">线上剩余比例</Label>
                  <Input
                    type="text"
                    disabled
                    value={`${syncModalData.remainingVal.toFixed(2)}%`}
                    className="bg-zinc-800/40 border-zinc-800 text-zinc-200 font-bold text-sm cursor-not-allowed h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sync-dialog-week-select" className="text-xs text-zinc-400">业务周</Label>
                  <Select
                    id="sync-dialog-week-select"
                    value={syncModalData.weekNumber}
                    onChange={(val) => setSyncModalData(prev => ({ ...prev, weekNumber: Number(val) }))}
                    options={buildWeekOptions(syncModalData.item.weeks_count, syncModalData.item.current_week_num)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sync-dialog-desc" className="text-xs text-zinc-400">消耗事项（说明）</Label>
                <textarea
                  id="sync-dialog-desc"
                  required
                  value={syncModalData.desc}
                  onChange={(e) => setSyncModalData(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="如：跑批量评估接口 / 中英翻译"
                  rows={3}
                  className="w-full text-sm p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              <DialogFooter className="border-t border-zinc-800 pt-4">
                <Button
                  id="sync-dialog-cancel"
                  type="button"
                  onClick={() => setSyncModalData(null)}
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold"
                  aria-label="取消同步"
                >
                  取消
                </Button>
                <Button
                  id="sync-dialog-submit"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold"
                  aria-label="确定并同步记账"
                >
                  确认同步
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Batch Sync Modal */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden border-zinc-800 bg-zinc-900 p-0 text-zinc-100">
          <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <DialogTitle className="flex items-center pr-8 text-base font-bold text-zinc-100">
              <Copy className="mr-2 text-blue-500" size={18} />
              集中扫视与批量对齐
            </DialogTitle>
            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-800 py-0.5 px-2 text-[10px]">
              监测到 {batchItems.length} 个账号变动
            </Badge>
          </div>
          
          <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-950/20 p-4 sm:p-6">
            <form id="batch-form" onSubmit={handleBatchSubmit} className="space-y-3">
              {batchItems.map((item, idx) => (
                <div key={item.id} className={`rounded-xl border p-4 transition-all duration-200 ${item.selected ? 'border-blue-500/40 bg-zinc-900/80 shadow-md' : 'border-zinc-800 bg-zinc-950/20 opacity-60'}`}>
                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(190px,0.8fr)_minmax(220px,1.25fr)] md:items-end">
                    <div className="flex min-w-0 items-center gap-3">
                      <input
                        id={`batch-checkbox-${item.id}`}
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const newItems = [...batchItems];
                          newItems[idx].selected = e.target.checked;
                          setBatchItems(newItems);
                        }}
                        className="w-4 h-4 rounded text-blue-600 border-zinc-700 focus:ring-0 focus:ring-offset-0 bg-zinc-900 cursor-pointer accent-blue-600"
                        aria-label={`勾选同步账号 ${item.name}`}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-zinc-200" title={item.name}>{item.name}</div>
                        {item.isReset ? (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded inline-block mt-0.5">额度已充置</span>
                        ) : (
                          <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">前次: {item.baseline}%</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid min-w-0 grid-cols-[minmax(72px,0.7fr)_minmax(110px,1fr)] items-end gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] text-zinc-500 font-semibold">线上剩余</span>
                        <span className="font-bold text-blue-400 text-xs mt-0.5">{item.remaining.toFixed(2)}%</span>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] text-zinc-500 font-semibold mb-1">记入周次</span>
                        <Select
                          id={`batch-week-${item.id}`}
                          value={item.week_number}
                          onChange={(val) => {
                            const newItems = [...batchItems];
                            newItems[idx].week_number = Number(val);
                            setBatchItems(newItems);
                          }}
                          options={buildWeekOptions(item.weeks_count, item.week_number)}
                        />
                      </div>
                    </div>
                    
                    <div className="min-w-0">
                      <Label htmlFor={`batch-desc-${item.id}`} className="block text-[10px] font-semibold text-zinc-500 mb-1">消耗描述（事件）</Label>
                      <Input
                        id={`batch-desc-${item.id}`}
                        type="text"
                        required={item.selected}
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...batchItems];
                          newItems[idx].description = e.target.value;
                          setBatchItems(newItems);
                        }}
                        placeholder="如: 代码调试 / API 测试"
                        className="w-full bg-zinc-950/50 border-zinc-800 text-xs focus-visible:ring-blue-500/30 text-zinc-200 h-9 px-3 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </form>
          </div>
          
          <div className="flex flex-col gap-4 border-t border-zinc-800 bg-zinc-900/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-zinc-400 hover:text-zinc-200">
              <input
                id="batch-select-all"
                type="checkbox"
                checked={batchItems.length > 0 && batchItems.every(i => i.selected)}
                onChange={(e) => {
                  const newItems = batchItems.map(i => ({ ...i, selected: e.target.checked }));
                  setBatchItems(newItems);
                }}
                className="w-4 h-4 rounded text-blue-600 border-zinc-700 bg-zinc-900 cursor-pointer accent-blue-600"
                aria-label="选择全部或取消全选"
              />
              <span>全选 / 取消全选</span>
            </label>
            <div className="flex w-full gap-2.5 sm:w-auto">
              <Button
                id="batch-sync-cancel"
                type="button"
                onClick={() => setShowBatchModal(false)}
                variant="ghost"
                className="h-9 flex-1 rounded-xl px-4 text-xs font-semibold text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 sm:flex-none"
                aria-label="取消批量记账"
              >
                取消
              </Button>
              <Button
                id="batch-sync-submit"
                form="batch-form"
                type="submit"
                disabled={!batchItems.some(i => i.selected)}
                className="h-9 flex-1 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-zinc-100 shadow-lg shadow-blue-500/10 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                aria-label="确认提交批量记账表单"
              >
                确认对齐记账 ({batchItems.filter(i => i.selected).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
