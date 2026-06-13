import { useState, useEffect, useCallback } from 'react'
import Select from './Select'
import {
  Plus, Download, Edit, Trash, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { accountsApi, recordsApi } from '../api/client'

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v ?? 0)
const fmtDate = (s) => {
  const d = new Date(s + 'Z')
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const formatWeekLabel = (weekNumber, cycleWeeksCount) => (
  cycleWeeksCount && weekNumber > cycleWeeksCount
    ? `第 ${weekNumber} 周（超配置）`
    : `第 ${weekNumber} 周`
)

const buildWeekOptions = (cycle) => {
  if (!cycle) {
    return Array.from({ length: 4 }, (_, i) => i + 1).map((w) => ({
      value: w,
      label: formatWeekLabel(w),
    }))
  }

  const maxRecordedWeek = cycle.max_recorded_week || 0
  const optionMax = Math.max(cycle.weeks_count, cycle.current_week_num || 1, maxRecordedWeek + 1)

  return Array.from({ length: optionMax }, (_, i) => i + 1).map((w) => ({
    value: w,
    label: formatWeekLabel(w, cycle.weeks_count),
  }))
}

function Toast({ msg }) {
  if (!msg.text) return null
  return (
    <div className={`p-4 rounded-xl flex items-center space-x-2 ${msg.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
      {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="font-medium text-sm">{msg.text}</span>
    </div>
  )
}

export default function RecordsManager() {
  const [records, setRecords]   = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState({ text: '', type: '' })

  const [filterAccId, setFilterAccId] = useState('all')
  const [showModal,   setShowModal]   = useState(false)
  const [editingRec,  setEditingRec]  = useState(null)
  const [deletingRec, setDeletingRec] = useState(null)

  // Form state
  const [formAccId,      setFormAccId]      = useState('')
  const [formWeek,       setFormWeek]       = useState(1)
  const [formRemaining,  setFormRemaining]  = useState('')
  const [formConsumed,   setFormConsumed]   = useState('')
  const [formDesc,       setFormDesc]       = useState('')
  const [isLinked,       setIsLinked]       = useState(true)
  const [prevRemaining,  setPrevRemaining]  = useState(100)
  const [activeCycles,   setActiveCycles]   = useState([])

  // Codex Quota States
  const [fetchingQuota,  setFetchingQuota]  = useState(false)
  const [quotaError,     setQuotaError]     = useState('')
  const [quotaData,      setQuotaData]      = useState(null)
  const [showTokenUpdate, setShowTokenUpdate] = useState(false)
  const [newTokenValue, setNewTokenValue]   = useState('')

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
    
    return `${formattedDate} (${remainingText})`
  }

  const handleFetchQuota = useCallback(async (targetId = formAccId, force = false) => {
    if (!targetId) return
    setFetchingQuota(true)
    setQuotaError('')
    setQuotaData(null)
    try {
      const res = await accountsApi.fetchBalance(targetId, force)
      setQuotaData(res.data)
      
      // Auto-detect reset and switch to next week
      const acc = accounts.find(a => a.id === targetId)
      if (acc?.active_cycle) {
        const onlineRemaining = res.data.secondary_remaining_percent !== null 
          ? res.data.secondary_remaining_percent 
          : res.data.primary_remaining_percent
        
        const currentWeekNum = acc.active_cycle.current_week_num || 1
        const weekRecs = records.filter(
          r => r.account_id === targetId &&
               r.cycle_id === acc.active_cycle.id &&
               r.week_number === currentWeekNum
        )
        let weekPrevRemaining = 100
        if (weekRecs.length > 0) {
          const latest = weekRecs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0]
          weekPrevRemaining = latest.remaining_pct
        }
        
        if (onlineRemaining !== null && onlineRemaining > weekPrevRemaining) {
          const nextWeek = currentWeekNum + 1
          setFormWeek(nextWeek)
          flash(`检测到额度重置，已自动调整至第 ${nextWeek} 周`, 'success')
        }
      }
      
      return res.data
    } catch (err) {
      setQuotaError(err.response?.data?.detail || '获取额度失败，请检查配置或网络')
    } finally {
      setFetchingQuota(false)
    }
  }, [formAccId, accounts, records])

  const handleUpdateToken = async () => {
    if (!newTokenValue.trim()) return
    try {
      const acc = accounts.find(a => a.id === formAccId)
      await accountsApi.update(formAccId, {
        name: acc.name,
        api_type: acc.api_type,
        api_url: acc.api_url,
        api_key: newTokenValue.trim(),
        api_account_id: acc.api_account_id,
      })
      flash('Token 更新成功！')
      setShowTokenUpdate(false)
      setNewTokenValue('')
      await loadAccounts()
      handleFetchQuota(formAccId).catch(() => {})
    } catch {
      flash('Token 更新失败', 'error')
    }
  }

  // Reset and auto-fetch quota data when selected account or modal state changes
  useEffect(() => {
    setQuotaData(null)
    setQuotaError('')
    setShowTokenUpdate(false)
    setNewTokenValue('')
    if (showModal && formAccId) {
      const acc = accounts.find(a => a.id === formAccId)
      if (acc && acc.api_type === 'codex') {
        handleFetchQuota(formAccId).catch(() => {})
      }
    }
  }, [formAccId, showModal, accounts, handleFetchQuota])

  const flash = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const loadAccounts = useCallback(async () => {
    const res = await accountsApi.list()
    const all = res.data
    setAccounts(all)
    const active = all.filter(a => a.status === 'active' && a.active_cycle)
    setActiveCycles(active)
    setFormAccId((current) => {
      if (current && active.some((a) => a.id === current)) return current
      return active[0]?.id || ''
    })
  }, [])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterAccId !== 'all' ? { account_id: filterAccId } : {}
      const res = await recordsApi.list(params)
      setRecords(res.data)
    } catch {
      flash('加载流水失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterAccId])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadRecords() }, [loadRecords])

  // Update week and prev-remaining when account or week changes
  useEffect(() => {
    if (!showModal || !formAccId) return
    const acc = accounts.find(a => a.id === formAccId)
    if (!acc?.active_cycle) return
    setFormWeek(Math.max(acc.active_cycle.current_week_num || 1, 1))
  }, [formAccId, accounts, showModal])

  useEffect(() => {
    if (!formAccId) return
    const acc = accounts.find(a => a.id === formAccId)
    if (!acc?.active_cycle) { setPrevRemaining(100); return }
    const weekRecs = records.filter(
      (r) =>
        r.account_id === formAccId &&
        r.cycle_id === acc.active_cycle.id &&
        r.week_number === Number(formWeek)
    )
    if (weekRecs.length > 0) {
      const latest = weekRecs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0]
      setPrevRemaining(latest.remaining_pct)
    } else {
      setPrevRemaining(100)
    }
  }, [formAccId, formWeek, records, accounts])

  const handleRemainingChange = (val) => {
    setFormRemaining(val)
    if (isLinked) {
      const r = parseFloat(val)
      if (!isNaN(r)) setFormConsumed(+(prevRemaining - r).toFixed(2))
      else setFormConsumed('')
    }
  }
  const handleConsumedChange = (val) => {
    setFormConsumed(val)
    if (isLinked) {
      const c = parseFloat(val)
      if (!isNaN(c)) setFormRemaining(+(prevRemaining - c).toFixed(2))
      else setFormRemaining('')
    }
  }

  const previewAmt = () => {
    const acc = accounts.find(a => a.id === formAccId)
    if (!acc?.active_cycle) return 0
    return acc.active_cycle.weekly_budget * ((parseFloat(formConsumed) || 0) / 100)
  }

  const resetForm = () => {
    setFormRemaining(''); setFormConsumed(''); setFormDesc(''); setIsLinked(true)
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault()
    const rPct = parseFloat(formRemaining)
    const cPct = parseFloat(formConsumed)
    if (isNaN(rPct) || isNaN(cPct)) { flash('请填入有效数字', 'error'); return }
    if (rPct < 0 || rPct > 100)     { flash('剩余%需在 0~100 之间', 'error'); return }
    if (cPct < 0)                   { flash('消耗%不能为负数', 'error'); return }
    try {
      await recordsApi.create({
        account_id: formAccId,
        week_number: Number(formWeek),
        remaining_pct: rPct,
        consumed_pct: cPct,
        description: formDesc || null,
      })
      await Promise.all([loadRecords(), loadAccounts()])
      setShowModal(false); resetForm()
      flash('记账成功')
    } catch (err) {
      flash(err.response?.data?.detail || '记账失败', 'error')
    }
  }


  // ── Edit ─────────────────────────────────────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault()
    try {
      await recordsApi.update(editingRec.id, {
        remaining_pct: parseFloat(editingRec.remaining_pct),
        consumed_pct:  parseFloat(editingRec.consumed_pct),
        description:   editingRec.description,
      })
      await Promise.all([loadRecords(), loadAccounts()])
      setEditingRec(null)
      flash('修改成功，累计数据已重算')
    } catch (err) {
      flash(err.response?.data?.detail || '修改失败', 'error')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      await recordsApi.delete(deletingRec.id)
      await Promise.all([loadRecords(), loadAccounts()])
      setDeletingRec(null)
      flash('流水已删除，累计数据已校准')
    } catch {
      flash('删除失败', 'error')
    }
  }

  const handleExport = () => {
    recordsApi.exportCsv(filterAccId !== 'all' ? { account_id: filterAccId } : {})
  }

  const selectedAccCycle = accounts.find(a => a.id === formAccId)?.active_cycle
  const selectedAccount = accounts.find(a => a.id === formAccId)
  const hasApiQuery = selectedAccount && selectedAccount.api_type === 'codex'


  return (
    <div className="space-y-5">
      <Toast msg={msg} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">账单流水</h2>
        <div className="flex space-x-3">
          <button onClick={handleExport} className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition text-sm font-medium">
            <Download size={16} /><span>导出 CSV</span>
          </button>
          <button
            onClick={() => { if (activeCycles.length === 0) { flash('请先创建账号并保证有活跃周期', 'error'); return } setShowModal(true) }}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-md hover:bg-blue-700 transition text-sm font-medium"
          >
            <Plus size={16} /><span>记录消耗</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-slate-600">按账号:</label>
          <Select
            value={filterAccId}
            onChange={setFilterAccId}
            options={[
              { value: 'all', label: '所有账号' },
              ...accounts.map(a => ({ value: a.id, label: a.name }))
            ]}
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['时间 / 账号', '周期 / 周', '登记剩余', '消耗事项', '消耗 / 扣费', '本周累计', '操作'].map((h, i) => (
                  <th key={h} className={`px-5 py-4 text-xs font-semibold uppercase tracking-wider ${
                    i === 0 ? 'text-slate-500' : i === 2 ? 'text-emerald-600' : i === 4 ? 'text-rose-500' : i === 6 ? 'text-right text-slate-500' : 'text-slate-500'
                  } text-left`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && <tr><td colSpan={7} className="py-16 text-center text-slate-400 animate-pulse text-sm">加载中...</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">暂无流水记录</td></tr>}
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-800">{r.account_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{fmtDate(r.created_at)}</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-700">第 {r.cycle_number} 期</div>
                    <div className={`text-xs font-medium mt-0.5 ${r.is_extra_week ? 'text-amber-600' : 'text-blue-600'}`}>
                      {formatWeekLabel(r.week_number, r.cycle_weeks_count)}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">{r.remaining_pct}%</td>
                  <td className="px-5 py-4">
                    <div className="text-sm text-slate-700 max-w-[130px] truncate" title={r.description || '—'}>
                      {r.description || <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-rose-600">{fmt(r.consumed_amount)}</div>
                    <div className="text-xs font-bold text-rose-400 mt-0.5">-{r.consumed_pct}%</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-slate-800">{fmt(r.cumulative_amount)}</div>
                    <div className="text-xs text-slate-400 mt-0.5">进度: {r.cumulative_pct}%</div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right space-x-1.5">
                    <button onClick={() => setEditingRec({ ...r })} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={15} /></button>
                    <button onClick={() => setDeletingRec(r)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"><Trash size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Record Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-in">
            <h3 className="text-xl font-bold mb-5 text-slate-800 flex items-center"><Plus className="mr-2" size={20} />记录消耗</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Account select */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">选择账号</label>
                <Select
                  value={formAccId}
                  onChange={setFormAccId}
                  options={activeCycles.map(a => ({
                    value: a.id,
                    label: `${a.name}（第 ${a.active_cycle?.cycle_number} 期）`
                  }))}
                />
              </div>
              {/* Week select */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">业务周</label>
                  <Select
                    value={formWeek}
                    onChange={setFormWeek}
                    options={buildWeekOptions(selectedAccCycle)}
                  />
                </div>
                <div className="pb-1 px-1 space-y-1">
                  <p className="text-xs text-slate-500">
                    本周上次剩余基准: <span className="font-bold text-slate-800">{prevRemaining}%</span>
                  </p>
                  {selectedAccCycle && (
                    <p className="text-[11px] text-slate-400">
                      本期按配置 {selectedAccCycle.weeks_count} 周均摊周预算；超出后会继续沿用同一周预算记账。
                    </p>
                  )}
                </div>
              </div>
              
              {/* Codex Quota Query Section */}
              {hasApiQuery && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-blue-800">Codex 实时额度查询</span>
                    <button
                      type="button"
                      disabled={fetchingQuota}
                      onClick={() => handleFetchQuota(formAccId, true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1 disabled:opacity-50"
                    >
                      {fetchingQuota ? '查询中...' : '重新查询'}
                    </button>
                  </div>
                  
                  {quotaError && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-rose-500 font-medium">{quotaError}</p>
                      {!showTokenUpdate ? (
                        <button
                          type="button"
                          onClick={() => { setShowTokenUpdate(true); setNewTokenValue('') }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline"
                        >
                          快捷更新 Token
                        </button>
                      ) : (
                        <div className="mt-1.5 p-2 bg-white rounded border border-slate-200 space-y-1.5">
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
                              onClick={() => setShowTokenUpdate(false)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-medium"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={handleUpdateToken}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium"
                            >
                              保存并重试
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {quotaData && (
                    <div className="space-y-2 text-xs">
                      <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 font-medium">
                        <p>账号套餐: <span className="font-bold text-blue-700 uppercase">{quotaData.plan_type || '未知'}</span></p>
                        {quotaData.token_expires_at && (
                          <p>Token 有效期至: {formatTokenExpiry(quotaData.token_expires_at)}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {quotaData.primary_remaining_percent !== null && (
                          <div className="p-2 bg-white rounded-lg border border-slate-100 flex flex-col justify-between">
                            <div>
                              <span className="block font-medium text-slate-600">5小时额度剩余</span>
                              <span className="block font-bold text-blue-600 text-sm mt-0.5">
                                {quotaData.primary_remaining_percent.toFixed(2)}%
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                已用: {quotaData.primary_used_percent}%
                              </span>
                              {quotaData.primary_reset_after_seconds > 0 && (
                                <span className="block text-[10px] text-amber-600 mt-0.5 font-medium leading-normal">
                                  刷新时间: <span className="font-bold">{getResetCalendarTime(quotaData.primary_reset_after_seconds)}</span>
                                  <span className="block text-[9px] text-amber-500">({formatSeconds(quotaData.primary_reset_after_seconds)}后)</span>
                                </span>
                              )}
                            </div>
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleRemainingChange(+(quotaData.primary_remaining_percent).toFixed(2))}
                                className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-1 px-1.5 rounded text-[10px] transition-colors"
                              >
                                填入此剩余
                              </button>
                            </div>
                          </div>
                        )}
                        {quotaData.secondary_remaining_percent !== null && (
                          <div className="p-2 bg-white rounded-lg border border-slate-100 flex flex-col justify-between">
                            <div>
                              <span className="block font-medium text-slate-600">本周额度剩余</span>
                              <span className="block font-bold text-emerald-600 text-sm mt-0.5">
                                {quotaData.secondary_remaining_percent.toFixed(2)}%
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                已用: {quotaData.secondary_used_percent}%
                              </span>
                              {quotaData.secondary_reset_after_seconds > 0 && (
                                <span className="block text-[10px] text-amber-600 mt-0.5 font-medium leading-normal">
                                  刷新时间: <span className="font-bold">{getResetCalendarTime(quotaData.secondary_reset_after_seconds)}</span>
                                  <span className="block text-[9px] text-amber-500">({formatSeconds(quotaData.secondary_reset_after_seconds)}后)</span>
                                </span>
                              )}
                            </div>
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleRemainingChange(+(quotaData.secondary_remaining_percent).toFixed(2))}
                                className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold py-1 px-1.5 rounded text-[10px] transition-colors"
                              >
                                填入此剩余
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Linked input */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-start space-x-2 mb-3 cursor-pointer">
                  <input type="checkbox" checked={isLinked} onChange={(e) => setIsLinked(e.target.checked)} className="mt-0.5 rounded text-blue-600 w-4 h-4" />
                  <span className="text-sm font-medium text-slate-700">
                    双向联动换算
                    <span className="block text-xs text-slate-500 font-normal mt-0.5">取消勾选可独立录入（官方重置/发福利等特殊情况）</span>
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-blue-700 mb-1">官方面板剩余 %</label>
                    <input type="number" value={formRemaining} onChange={(e) => handleRemainingChange(e.target.value)} required min="0" max="100" step="0.01" className="form-input border-2 border-blue-200 focus:border-blue-500 focus:ring-blue-500/20 font-bold text-blue-800 bg-white" placeholder="例: 85.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-rose-600 mb-1">本次消耗额度 %</label>
                    <input type="number" value={formConsumed} onChange={(e) => handleConsumedChange(e.target.value)} required min="0" step="0.01" className="form-input border-2 border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 font-bold text-rose-800 bg-white" placeholder="例: 14.5" />
                  </div>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">消耗事项（选填）</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} placeholder="例: 跑批量数据接口" className="form-input resize-none" />
              </div>
              {/* Preview */}
              {formConsumed !== '' && !isNaN(parseFloat(formConsumed)) && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm flex justify-between">
                  <span className="text-rose-600 font-medium">本次消耗预估扣费:</span>
                  <span className="font-bold text-rose-700">{fmt(previewAmt())}</span>
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm">取消</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm shadow-md shadow-blue-200">确认记账</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingRec && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-in">
            <h3 className="text-xl font-bold mb-5 text-slate-800">修改流水数据</h3>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">当时剩余 %</label>
                  <input type="number" value={editingRec.remaining_pct} onChange={(e) => setEditingRec({ ...editingRec, remaining_pct: e.target.value })} step="0.01" min="0" max="100" required className="form-input border-2 border-blue-200 focus:border-blue-500 font-bold text-blue-800 bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rose-600 mb-1">本次消耗 %</label>
                  <input type="number" value={editingRec.consumed_pct} onChange={(e) => setEditingRec({ ...editingRec, consumed_pct: e.target.value })} step="0.01" min="0" required className="form-input border-2 border-rose-200 focus:border-rose-500 font-bold text-rose-800 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">消耗事项</label>
                <textarea value={editingRec.description || ''} onChange={(e) => setEditingRec({ ...editingRec, description: e.target.value })} className="form-input resize-none" rows={2} />
              </div>
              <p className="text-xs text-amber-600 flex items-center">
                <AlertCircle size={12} className="mr-1 flex-shrink-0" />保存后系统将自动级联重算该周后续所有账单的累计金额。
              </p>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setEditingRec(null)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm">取消</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">保存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingRec && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center animate-in">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash size={26} /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">确认删除该笔流水？</h3>
            <p className="text-xs text-slate-500 mb-6">删除后该周累计进度将自动校准，此操作不可逆。</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeletingRec(null)} className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium text-sm">取消</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-medium text-sm">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
