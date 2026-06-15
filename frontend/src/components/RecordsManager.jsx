import { useState, useEffect, useCallback } from 'react'
import Select from './Select'
import {
  Plus, Download, Edit, Trash, AlertCircle, CheckCircle2, HelpCircle, RefreshCw,
  CalendarDays, Search, X,
} from 'lucide-react'
import { accountsApi, recordsApi } from '../api/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v ?? 0)
const fmtDate = (s) => {
  const d = new Date(s + 'Z')
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
const formatWeekLabel = (weekNumber, cycleWeeksCount) => (
  cycleWeeksCount && weekNumber > cycleWeeksCount
    ? `第 ${weekNumber} 周 (超配置)`
    : `第 ${weekNumber} 周`
)

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDateRange = (days) => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  }
}

const toUtcBoundary = (dateValue, isEnd = false) => {
  if (!dateValue) return undefined
  const date = new Date(`${dateValue}T00:00:00`)
  if (isEnd) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

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
    <div className={`fixed top-6 right-6 px-4 py-3 rounded-xl flex items-center space-x-2.5 z-50 shadow-xl border backdrop-blur-md transition-all duration-300 animate-in ${msg.type === 'error' ? 'bg-rose-950/90 border-rose-800/40 text-rose-200' : 'bg-emerald-950/90 border-emerald-800/40 text-emerald-200'}`}>
      {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span className="font-semibold text-xs tracking-wide">{msg.text}</span>
    </div>
  )
}

export default function RecordsManager() {
  const [records, setRecords]   = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState({ text: '', type: '' })

  const [filterAccId, setFilterAccId] = useState('all')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [activeDatePreset, setActiveDatePreset] = useState('all')
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

  useEffect(() => {
    setQuotaData(null)
    setQuotaError('')
    setShowTokenUpdate(false)
    setNewTokenValue('')
  }, [formAccId, showModal])

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
      const params = {
        ...(filterAccId !== 'all' ? { account_id: filterAccId } : {}),
        ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
        ...(filterStartDate ? { created_from: toUtcBoundary(filterStartDate) } : {}),
        ...(filterEndDate ? { created_before: toUtcBoundary(filterEndDate, true) } : {}),
      }
      const res = await recordsApi.list(params)
      setRecords(res.data)
    } catch {
      flash('加载流水失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterAccId, debouncedKeyword, filterStartDate, filterEndDate])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadRecords() }, [loadRecords])
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(filterKeyword.trim()), 300)
    return () => clearTimeout(timer)
  }, [filterKeyword])

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

  const getFilterParams = () => ({
    ...(filterAccId !== 'all' ? { account_id: filterAccId } : {}),
    ...(filterKeyword.trim() ? { keyword: filterKeyword.trim() } : {}),
    ...(filterStartDate ? { created_from: toUtcBoundary(filterStartDate) } : {}),
    ...(filterEndDate ? { created_before: toUtcBoundary(filterEndDate, true) } : {}),
  })

  const handleExport = () => {
    recordsApi.exportCsv(getFilterParams())
  }

  const applyDatePreset = (preset) => {
    setActiveDatePreset(preset)
    if (preset === 'all') {
      setFilterStartDate('')
      setFilterEndDate('')
      return
    }
    const range = getDateRange(Number(preset))
    setFilterStartDate(range.start)
    setFilterEndDate(range.end)
  }

  const clearFilters = () => {
    setFilterAccId('all')
    setFilterKeyword('')
    setDebouncedKeyword('')
    setFilterStartDate('')
    setFilterEndDate('')
    setActiveDatePreset('all')
  }

  const selectedAccCycle = accounts.find(a => a.id === formAccId)?.active_cycle
  const selectedAccount = accounts.find(a => a.id === formAccId)
  const hasApiQuery = selectedAccount && selectedAccount.api_type === 'codex'
  const hasActiveFilters = (
    filterAccId !== 'all' ||
    filterKeyword ||
    filterStartDate ||
    filterEndDate
  )

  return (
    <div className="space-y-6">
      <Toast msg={msg} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">账单流水</h2>
          <p className="text-xs text-zinc-400 mt-0.5">对每个账号按业务周进行消耗记账并查看流水历史</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            id="records-export-csv-btn"
            onClick={handleExport}
            variant="outline"
            className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs h-10 px-4 rounded-xl shadow-sm"
            aria-label="导出流水明细为 CSV 文件"
          >
            <Download size={14} className="mr-1.5" />
            <span>导出 CSV</span>
          </Button>
          <Button
            id="records-create-record-btn"
            onClick={() => { if (activeCycles.length === 0) { flash('请先创建账号并保证有活跃周期', 'error'); return } setShowModal(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-zinc-100 flex items-center space-x-1 text-xs px-3.5 py-5 rounded-xl shadow-lg shadow-blue-500/10"
            aria-label="手动记录额度消耗流水"
          >
            <Plus size={15} />
            <span>记录消耗</span>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-zinc-900/30 border border-zinc-900/85 backdrop-blur-xl p-4 sm:p-5 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1.2fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="records-filter-select" className="text-[11px] font-bold text-zinc-500">账号</Label>
              <Select
                id="records-filter-select"
                value={filterAccId}
                onChange={setFilterAccId}
                options={[
                  { value: 'all', label: '所有账号' },
                  ...accounts.map(a => ({ value: a.id, label: a.name }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="records-keyword-input" className="text-[11px] font-bold text-zinc-500">关键词</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="records-keyword-input"
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  placeholder="搜索账号或消耗事项"
                  className="h-10 rounded-xl border-zinc-800 bg-zinc-900/30 pl-9 pr-9 text-sm text-zinc-200 placeholder:text-zinc-600"
                />
                {filterKeyword && (
                  <button
                    type="button"
                    onClick={() => setFilterKeyword('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200"
                    aria-label="清空关键词"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="records-start-date" className="text-[11px] font-bold text-zinc-500">开始日期</Label>
              <Input
                id="records-start-date"
                type="date"
                value={filterStartDate}
                max={filterEndDate || undefined}
                onChange={(e) => {
                  setFilterStartDate(e.target.value)
                  setActiveDatePreset('custom')
                }}
                className="h-10 rounded-xl border-zinc-800 bg-zinc-900/30 px-3 text-sm text-zinc-300 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="records-end-date" className="text-[11px] font-bold text-zinc-500">结束日期</Label>
              <Input
                id="records-end-date"
                type="date"
                value={filterEndDate}
                min={filterStartDate || undefined}
                onChange={(e) => {
                  setFilterEndDate(e.target.value)
                  setActiveDatePreset('custom')
                }}
                className="h-10 rounded-xl border-zinc-800 bg-zinc-900/30 px-3 text-sm text-zinc-300 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={clearFilters}
            variant="outline"
            disabled={!hasActiveFilters}
            className="h-10 rounded-xl border-zinc-800 bg-zinc-900/30 px-4 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X size={14} />
            清空筛选
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t border-zinc-800/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
              <CalendarDays size={13} />
              快捷时间
            </span>
            {[
              { value: 'all', label: '全部' },
              { value: '1', label: '今天' },
              { value: '7', label: '近 7 天' },
              { value: '30', label: '近 30 天' },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyDatePreset(preset.value)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeDatePreset === preset.value
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                    : 'border-zinc-800 bg-zinc-900/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-zinc-400 font-mono">
            <span>筛选流水: <span className="text-zinc-200 font-bold">{records.length} 笔</span></span>
            <span>当前总耗: <span className="text-rose-400 font-bold">{fmt(records.reduce((s, r) => s + r.consumed_amount, 0))}</span></span>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-zinc-900/30 border border-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-950/20 border-b border-zinc-800">
              <TableRow className="hover:bg-transparent border-zinc-800">
                <TableHead className="text-zinc-400 font-semibold text-xs h-12">时间 / 账号</TableHead>
                <TableHead className="text-zinc-400 font-semibold text-xs h-12">周期 / 周</TableHead>
                <TableHead className="text-emerald-400 font-semibold text-xs h-12">登记剩余</TableHead>
                <TableHead className="text-zinc-400 font-semibold text-xs h-12">消耗事项</TableHead>
                <TableHead className="text-rose-400 font-semibold text-xs h-12">消耗 / 扣费</TableHead>
                <TableHead className="text-zinc-400 font-semibold text-xs h-12">本周累计</TableHead>
                <TableHead className="text-zinc-400 font-semibold text-xs h-12 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-20 text-center text-zinc-500 text-xs animate-pulse border-zinc-800">
                    <RefreshCw className="animate-spin text-blue-500 w-6 h-6 mx-auto mb-2" />
                    正在加载流水记录...
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-16 text-center text-zinc-500 text-sm border-zinc-800">
                    暂无流水记录
                  </TableCell>
                </TableRow>
              )}
              {!loading && records.map(r => (
                <TableRow key={r.id} className="hover:bg-zinc-800/20 border-zinc-800/60 transition-colors">
                  <TableCell className="py-3.5">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span className="text-sm font-bold text-zinc-200">{r.account_name}</span>
                      {r.description && (r.description.includes("同步") || r.description.toLowerCase().includes("sync") || r.description.includes("Successfully recorded")) ? (
                        <Badge className="bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/10 py-0 px-1.5 text-[9px] font-bold rounded-md shrink-0">
                          🤖 自动
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-800 py-0 px-1.5 text-[9px] font-bold rounded-md shrink-0">
                          ✍️ 手动
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{fmtDate(r.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-zinc-300 text-xs">第 {r.cycle_number} 期</div>
                    <div className="mt-0.5">
                      {r.is_extra_week ? (
                        <span className="text-[10px] font-semibold text-amber-400">第 {r.week_number} 周 (超配置)</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-400">第 {r.week_number} 周</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-emerald-400 text-sm font-sans">{r.remaining_pct}%</TableCell>
                  <TableCell>
                    <div className="text-zinc-300 text-xs max-w-[130px] truncate" title={r.description || '—'}>
                      {r.description || <span className="text-zinc-600">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-bold text-rose-400 font-sans">{fmt(r.consumed_amount)}</div>
                    <div className="text-[10px] font-semibold text-rose-500 mt-0.5">-{r.consumed_pct}%</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-zinc-200 text-xs font-semibold font-sans">{fmt(r.cumulative_amount)}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">占比: {r.cumulative_pct}%</div>
                  </TableCell>
                  <TableCell className="text-right space-x-1.5 py-3">
                    <Button
                      id={`record-edit-btn-${r.id}`}
                      onClick={() => setEditingRec({ ...r })}
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      aria-label="编辑此项流水记录"
                    >
                      <Edit size={13} />
                    </Button>
                    <Button
                      id={`record-delete-btn-${r.id}`}
                      onClick={() => setDeletingRec(r)}
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      aria-label="删除此项流水记录"
                    >
                      <Trash size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Record Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); resetForm() } }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-bold text-zinc-100 flex items-center">
              <Plus className="mr-2 text-blue-500" size={16} />
              记录消耗
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-record-account-select" className="text-xs text-zinc-400">选择账号</Label>
              <Select
                id="create-record-account-select"
                value={formAccId}
                onChange={setFormAccId}
                options={activeCycles.map(a => ({
                  value: a.id,
                  label: `${a.name} (第 ${a.active_cycle?.cycle_number} 期)`
                }))}
              />
            </div>
            
            <div className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-record-week-select" className="text-xs text-zinc-400">业务周</Label>
                <Select
                  id="create-record-week-select"
                  value={formWeek}
                  onChange={setFormWeek}
                  options={buildWeekOptions(selectedAccCycle)}
                />
              </div>
              <div className="space-y-1 bg-zinc-950/45 p-2 rounded-xl border border-zinc-800/40 text-[10px]">
                <p className="text-zinc-400">
                  本周剩余基准: <span className="font-bold text-zinc-200">{prevRemaining}%</span>
                </p>
                {selectedAccCycle && (
                  <p className="text-zinc-500 leading-tight">
                    均摊预算配置：共 {selectedAccCycle.weeks_count} 周。超出后将延用同一周预算。
                  </p>
                )}
              </div>
            </div>
            
            {/* Codex Quota Query Section */}
            {hasApiQuery && (
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/15 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-blue-400">Codex 实时配额查询</span>
                  <Button
                    id="create-record-quota-refresh-btn"
                    type="button"
                    variant="link"
                    disabled={fetchingQuota}
                    onClick={() => handleFetchQuota(formAccId, true)}
                    className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 p-0 h-auto flex items-center space-x-1"
                    aria-label="刷新线上配额余额"
                  >
                    {fetchingQuota ? <RefreshCw className="animate-spin text-blue-500" size={10} /> : null}
                    <span>{fetchingQuota ? '查询中...' : quotaData || quotaError ? '重新查询' : '查询线上额度'}</span>
                  </Button>
                </div>
                
                {quotaError && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-rose-400 font-medium leading-normal">{quotaError}</p>
                    {!showTokenUpdate ? (
                      <Button
                        id="create-record-token-shortcut-trigger"
                        type="button"
                        onClick={() => { setShowTokenUpdate(true); setNewTokenValue('') }}
                        variant="link"
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 p-0 h-auto"
                        aria-label="快速更新 Token 按钮"
                      >
                        快捷更新 Token
                      </Button>
                    ) : (
                      <div className="mt-1.5 p-2 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
                        <textarea
                          id="create-record-token-shortcut-textarea"
                          value={newTokenValue}
                          onChange={(e) => setNewTokenValue(e.target.value)}
                          placeholder="粘贴新 Access Token (ey...)"
                          rows={2}
                          className="w-full text-[10px] font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                        <div className="flex justify-end space-x-1.5">
                          <Button
                            id="create-record-token-shortcut-cancel"
                            type="button"
                            onClick={() => setShowTokenUpdate(false)}
                            variant="ghost"
                            className="h-6 px-2 text-[9px] text-zinc-400"
                            aria-label="取消Token更新"
                          >
                            取消
                          </Button>
                          <Button
                            id="create-record-token-shortcut-save"
                            type="button"
                            onClick={handleUpdateToken}
                            className="h-6 px-2 text-[9px] bg-blue-600 hover:bg-blue-700 text-zinc-100"
                            aria-label="保存Token配置"
                          >
                            保存并重试
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {quotaData && (
                  <div className="space-y-2 text-[10px]">
                    <div className="flex flex-col gap-0.5 text-zinc-400 font-medium">
                      <p>套餐类型: <span className="font-bold text-blue-400 uppercase">{quotaData.plan_type || 'Pro'}</span></p>
                      {quotaData.token_expires_at && (
                        <p className="font-mono">有效期至: {formatTokenExpiry(quotaData.token_expires_at)}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
                      {quotaData.primary_remaining_percent !== null && (
                        <div className="p-2 bg-zinc-950/45 rounded-lg border border-zinc-800/40 flex flex-col justify-between">
                          <div>
                            <span className="block font-medium text-zinc-400">5h额度剩余</span>
                            <span className="block font-bold text-blue-400 text-xs mt-0.5">
                              {quotaData.primary_remaining_percent.toFixed(2)}%
                            </span>
                            <span className="block text-[9px] text-zinc-500">
                              已用: {quotaData.primary_used_percent}%
                            </span>
                            {quotaData.primary_reset_after_seconds > 0 && (
                              <span className="block text-[9px] text-amber-500 mt-0.5 leading-normal">
                                重置: {getResetCalendarTime(quotaData.primary_reset_after_seconds)}
                                <span className="block text-[8px] text-zinc-500">({formatSeconds(quotaData.primary_reset_after_seconds)}后)</span>
                              </span>
                            )}
                          </div>
                          <Button
                            id="create-record-fill-primary"
                            type="button"
                            onClick={() => handleRemainingChange(+(quotaData.primary_remaining_percent).toFixed(2))}
                            className="w-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 font-bold h-6 text-[9px] rounded mt-2"
                            aria-label="填充5h剩余额度至表单"
                          >
                            填入该值
                          </Button>
                        </div>
                      )}
                      {quotaData.secondary_remaining_percent !== null && (
                        <div className="p-2 bg-zinc-950/45 rounded-lg border border-zinc-800/40 flex flex-col justify-between">
                          <div>
                            <span className="block font-medium text-zinc-400">周额度剩余</span>
                            <span className="block font-bold text-emerald-400 text-xs mt-0.5">
                              {quotaData.secondary_remaining_percent.toFixed(2)}%
                            </span>
                            <span className="block text-[9px] text-zinc-500">
                              已用: {quotaData.secondary_used_percent}%
                            </span>
                            {quotaData.secondary_reset_after_seconds > 0 && (
                              <span className="block text-[9px] text-amber-500 mt-0.5 leading-normal">
                                重置: {getResetCalendarTime(quotaData.secondary_reset_after_seconds)}
                                <span className="block text-[8px] text-zinc-500">({formatSeconds(quotaData.secondary_reset_after_seconds)}后)</span>
                              </span>
                            )}
                          </div>
                          <Button
                            id="create-record-fill-secondary"
                            type="button"
                            onClick={() => handleRemainingChange(+(quotaData.secondary_remaining_percent).toFixed(2))}
                            className="w-full bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 font-bold h-6 text-[9px] rounded mt-2"
                            aria-label="填充周剩余额度至表单"
                          >
                            填入该值
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Linked inputs */}
            <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800">
              <label className="flex items-start space-x-2 mb-3.5 cursor-pointer">
                <input
                  id="create-record-link-checkbox"
                  type="checkbox"
                  checked={isLinked}
                  onChange={(e) => setIsLinked(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 border-zinc-800 bg-zinc-900 cursor-pointer accent-blue-600 w-4 h-4"
                  aria-label="切换双向联动计算"
                />
                <span className="text-xs font-semibold text-zinc-300">
                  双向联动换算
                  <span className="block text-[10px] text-zinc-500 font-normal mt-0.5">取消后可支持特殊输入（如官方发糖、系统误差等）</span>
                </span>
              </label>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-record-remaining-pct" className="text-[11px] font-semibold text-blue-400">官方面板剩余 %</Label>
                  <Input
                    id="create-record-remaining-pct"
                    type="number"
                    value={formRemaining}
                    onChange={(e) => handleRemainingChange(e.target.value)}
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    className="bg-zinc-900 border-blue-500/30 text-blue-400 font-bold font-mono h-10 text-sm focus-visible:ring-blue-500/20"
                    placeholder="例: 85.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-record-consumed-pct" className="text-[11px] font-semibold text-rose-400">本次消耗额度 %</Label>
                  <Input
                    id="create-record-consumed-pct"
                    type="number"
                    value={formConsumed}
                    onChange={(e) => handleConsumedChange(e.target.value)}
                    required
                    min="0"
                    step="0.01"
                    className="bg-zinc-900 border-rose-500/30 text-rose-400 font-bold font-mono h-10 text-sm focus-visible:ring-rose-500/20"
                    placeholder="例: 14.5"
                  />
                </div>
              </div>
            </div>
            
            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="create-record-desc" className="text-xs text-zinc-400">消耗说明（事件名称）</Label>
              <Input
                id="create-record-desc"
                type="text"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11 text-zinc-200"
                placeholder="例: API 批量测试 / 文档翻译"
              />
            </div>
            
            {/* Preview */}
            {formConsumed !== '' && !isNaN(parseFloat(formConsumed)) && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-xs flex justify-between items-center">
                <span className="text-rose-400 font-medium">本次账单预估扣费金额:</span>
                <span className="font-bold text-rose-300 font-mono text-sm">{fmt(previewAmt())}</span>
              </div>
            )}
            
            <DialogFooter className="border-t border-zinc-800 pt-4">
              <Button
                id="create-record-cancel-btn"
                type="button"
                onClick={() => { setShowModal(false); resetForm() }}
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold"
                aria-label="取消记录流水"
              >
                取消
              </Button>
              <Button
                id="create-record-submit-btn"
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold"
                aria-label="提交流水账单表单"
              >
                确认提交
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingRec} onOpenChange={(open) => { if (!open) setEditingRec(null) }}>
        {editingRec && (
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-100">修改流水数据</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-record-remaining-pct" className="text-[11px] font-semibold text-blue-400">当时剩余 %</Label>
                  <Input
                    id="edit-record-remaining-pct"
                    type="number"
                    value={editingRec.remaining_pct}
                    onChange={(e) => setEditingRec({ ...editingRec, remaining_pct: e.target.value })}
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    className="bg-zinc-900 border-blue-500/30 text-blue-400 font-bold font-mono h-11 text-sm focus-visible:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-record-consumed-pct" className="text-[11px] font-semibold text-rose-400">本次消耗 %</Label>
                  <Input
                    id="edit-record-consumed-pct"
                    type="number"
                    value={editingRec.consumed_pct}
                    onChange={(e) => setEditingRec({ ...editingRec, consumed_pct: e.target.value })}
                    step="0.01"
                    min="0"
                    required
                    className="bg-zinc-900 border-rose-500/30 text-rose-400 font-bold font-mono h-11 text-sm focus-visible:ring-rose-500/20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-record-desc" className="text-xs text-zinc-400">消耗说明</Label>
                <textarea
                  id="edit-record-desc"
                  value={editingRec.description || ''}
                  onChange={(e) => setEditingRec({ ...editingRec, description: e.target.value })}
                  className="w-full text-sm p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-blue-500/50 resize-none"
                  rows={2}
                />
              </div>
              <p className="text-[10px] text-amber-500 flex items-center leading-normal">
                <AlertCircle size={12} className="mr-1.5 flex-shrink-0 text-amber-400" />
                提醒：保存后，系统将自动对该周后续的记录级联重算累计百分比与消耗。
              </p>
              <DialogFooter className="border-t border-zinc-800 pt-4">
                <Button
                  id="edit-record-cancel-btn"
                  type="button"
                  onClick={() => setEditingRec(null)}
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold"
                  aria-label="取消修改流水记录"
                >
                  取消
                </Button>
                <Button
                  id="edit-record-save-btn"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold"
                  aria-label="确认修改流水数据"
                >
                  保存修改
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deletingRec} onOpenChange={(open) => { if (!open) setDeletingRec(null) }}>
        {deletingRec && (
          <DialogContent className="max-w-sm border-zinc-800 bg-zinc-900 p-5 text-center text-zinc-100 sm:p-6">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash size={20} />
            </div>
            <DialogTitle className="text-base font-bold text-zinc-100 mb-1 justify-center flex">确认删除该笔流水？</DialogTitle>
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-6">
              删除后该周累计进度将自动级联校准，此操作<strong>不可恢复</strong>。
            </p>
            <DialogFooter className="flex-row justify-center gap-2 border-t border-zinc-800 pt-4">
              <Button
                id="delete-record-cancel-btn"
                onClick={() => setDeletingRec(null)}
                variant="ghost"
                className="flex-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold text-xs h-9 rounded-xl"
                aria-label="取消删除流水"
              >
                取消
              </Button>
              <Button
                id="delete-record-confirm-btn"
                onClick={handleDelete}
                variant="destructive"
                className="flex-1 font-semibold text-xs h-9 rounded-xl"
                aria-label="确定彻底删除流水记录"
              >
                确认删除
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
