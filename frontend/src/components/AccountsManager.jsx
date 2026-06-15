import { useState, useEffect, useCallback } from 'react'
import Select from './Select'
import {
  Plus, RefreshCw, Play, Power, Edit, Trash, AlertCircle, CheckCircle2, HelpCircle,
} from 'lucide-react'
import { accountsApi } from '../api/client'
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

function Toast({ msg }) {
  if (!msg.text) return null
  return (
    <div className={`fixed top-6 right-6 px-4 py-3 rounded-xl flex items-center space-x-2.5 z-50 shadow-xl border backdrop-blur-md transition-all duration-300 animate-in ${msg.type === 'error' ? 'bg-rose-950/90 border-rose-800/40 text-rose-200' : 'bg-emerald-950/90 border-emerald-800/40 text-emerald-200'}`}>
      {msg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span className="font-semibold text-xs tracking-wide">{msg.text}</span>
    </div>
  )
}

export default function AccountsManager({ onTabChange }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [msg, setMsg]           = useState({ text: '', type: '' })

  // Modals
  const [showCreate,   setShowCreate]   = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  const [editingAcc,   setEditingAcc]   = useState(null)
  const [deleteInfo,   setDeleteInfo]   = useState(null)
  const [targetAccId,  setTargetAccId]  = useState(null)

  // Forms
  const [newName,       setNewName]       = useState('')
  const [newAmount,     setNewAmount]     = useState(140)
  const [newWeeks,      setNewWeeks]      = useState(4)
  const [rechargeAmt,   setRechargeAmt]   = useState(140)
  const [rechargeWeeks, setRechargeWeeks] = useState(4)

  // API Config Forms
  const [newApiType,         setNewApiType]         = useState('disabled')
  const [newApiUrl,          setNewApiUrl]          = useState('https://chatgpt.com')
  const [newApiKey,          setNewApiKey]          = useState('')
  const [newApiAccountId,    setNewApiAccountId]    = useState('')
  const [newApiSessionToken, setNewApiSessionToken] = useState('')

  const flash = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountsApi.list()
      setAccounts(res.data)
    } catch {
      flash('加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Create ──────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault()
    if (newApiType === 'codex' && !newApiKey.trim() && !newApiSessionToken.trim()) {
      flash('Access Token 与 Session Cookie 必须至少填写一项', 'error')
      return
    }
    try {
      await accountsApi.create({
        name: newName,
        initial_amount: Number(newAmount),
        weeks_count: Number(newWeeks),
        api_type: newApiType,
        api_url: newApiUrl,
        api_key: newApiKey || null,
        api_account_id: newApiAccountId || null,
        api_session_token: newApiSessionToken || null,
      })
      setShowCreate(false); setNewName(''); setNewAmount(140); setNewWeeks(4)
      setNewApiType('disabled'); setNewApiUrl('https://chatgpt.com'); setNewApiKey(''); setNewApiAccountId(''); setNewApiSessionToken('')
      flash('账号创建成功，已开启第 1 期')
      load()
    } catch (err) {
      flash(err.response?.data?.detail || '创建失败', 'error')
    }
  }

  // ── Recharge ─────────────────────────────────────────────────────────────
  const handleRecharge = async (e) => {
    e.preventDefault()
    try {
      await accountsApi.recharge(targetAccId, { amount: Number(rechargeAmt), weeks_count: Number(rechargeWeeks) })
      setShowRecharge(false); setRechargeAmt(140); setRechargeWeeks(4)
      flash('续费成功，已开启新周期')
      load()
    } catch (err) {
      flash(err.response?.data?.detail || '续费失败', 'error')
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────
  const handleToggle = async (acc) => {
    try {
      await accountsApi.update(acc.id, { status: acc.status === 'active' ? 'disabled' : 'active' })
      flash('账号状态已更新')
      load()
    } catch {
      flash('操作失败', 'error')
    }
  }

  // ── Edit name ────────────────────────────────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault()
    if (editingAcc.api_type === 'codex' && !editingAcc.api_key?.trim() && !editingAcc.api_session_token?.trim()) {
      flash('Access Token 与 Session Cookie 必须至少填写一项', 'error')
      return
    }
    try {
      await accountsApi.update(editingAcc.id, {
        name: editingAcc.name,
        api_type: editingAcc.api_type || 'disabled',
        api_url: editingAcc.api_url || '',
        api_key: editingAcc.api_key || '',
        api_account_id: editingAcc.api_account_id || '',
        api_session_token: editingAcc.api_session_token || '',
      })
      setEditingAcc(null)
      flash('账号配置已修改')
      load()
    } catch {
      flash('修改失败', 'error')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const openDelete = async (acc) => {
    try {
      const res = await accountsApi.deleteInfo(acc.id)
      setDeleteInfo(res.data)
    } catch {
      flash('获取删除信息失败', 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await accountsApi.delete(deleteInfo.account_id)
      setDeleteInfo(null)
      flash('账号及相关数据已删除')
      load()
    } catch {
      flash('删除失败', 'error')
    }
  }

  const totalAccounts = accounts.length
  const activeAccounts = accounts.filter(a => a.status === 'active').length
  const apiQueryAccounts = accounts.filter(a => a.api_type === 'codex').length

  return (
    <div className="space-y-6">
      <Toast msg={msg} />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-50">账号与充值</h2>
          <p className="text-xs text-zinc-400 mt-0.5">管理数据统计口径、线上查询配置及收费期段</p>
        </div>
        <Button
          id="accounts-create-btn"
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-zinc-100 flex items-center space-x-1 text-xs px-3.5 py-4 rounded-xl shadow-lg shadow-blue-500/10"
          aria-label="新建账号"
        >
          <Plus size={15} />
          <span>新建账号</span>
        </Button>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/30 border border-zinc-900/80 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-zinc-850">
          <div>
            <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">全部账号数量</span>
            <span className="text-lg font-extrabold text-zinc-200 mt-1 block font-sans">{totalAccounts} 个</span>
          </div>
          <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-zinc-400 shadow-inner">
            <Plus size={16} />
          </div>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-900/80 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-zinc-850">
          <div>
            <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">活跃账号数量</span>
            <span className="text-lg font-extrabold text-emerald-400 mt-1 block font-sans">{activeAccounts} 个</span>
          </div>
          <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-emerald-400 shadow-inner">
            <Play size={16} />
          </div>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-900/80 backdrop-blur-xl p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:border-zinc-850">
          <div>
            <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">已配置线上查询</span>
            <span className="text-lg font-extrabold text-blue-400 mt-1 block font-sans">{apiQueryAccounts} 个</span>
          </div>
          <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800 text-blue-400 shadow-inner">
            <RefreshCw size={16} />
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/30 border border-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="animate-spin text-blue-500 w-7 h-7" />
            <span className="text-zinc-500 text-xs font-medium animate-pulse">正在读取账号列表...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-950/20 border-b border-zinc-800">
                <TableRow className="hover:bg-transparent border-zinc-800">
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12">账号名称</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12">当前期数</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12">账号状态</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12">当前周状态</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12">本期周预算</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs h-12 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12 text-center text-zinc-500 text-sm border-zinc-800">
                      暂无账号信息，请点击右上角新建账号
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc) => {
                    const cycle = acc.active_cycle
                    const isOverdue = cycle?.is_overdue
                    return (
                      <TableRow key={acc.id} className="hover:bg-zinc-800/20 border-zinc-800/60 transition-colors">
                        <TableCell className="font-semibold text-zinc-100 text-sm">{acc.name}</TableCell>
                        <TableCell className="text-zinc-300 text-xs font-medium">
                          {cycle ? (
                            <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/10 font-mono text-[10px] py-0 px-2">
                              第 {cycle.cycle_number} 期
                            </Badge>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">无活跃周期</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {acc.status === 'disabled' ? (
                            <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-800 text-[10px] font-medium py-0 px-2">
                              已停用
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 text-[10px] font-medium py-0 px-2">
                              使用中
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {cycle ? (
                            isOverdue ? (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10 text-[10px] font-medium py-0 px-2">
                                第 {cycle.current_week_num} 业务周 (超配置)
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 text-[10px] font-medium py-0 px-2">
                                第 {cycle.current_week_num} 业务周
                              </Badge>
                            )
                          ) : (
                            <Badge className="bg-zinc-800 text-zinc-500 border-zinc-800 hover:bg-zinc-800 text-[10px] font-medium py-0 px-2">
                              已归档
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-zinc-300">
                          {cycle ? fmt(cycle.weekly_budget) : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-1.5 py-3">
                          <Button
                            id={`account-recharge-${acc.id}`}
                            onClick={() => { setTargetAccId(acc.id); setShowRecharge(true) }}
                            disabled={acc.status === 'disabled'}
                            title="续费新周期"
                            variant="ghost"
                            className={`h-8 w-8 p-0 ${acc.status === 'disabled' ? 'text-zinc-600 cursor-not-allowed hover:bg-transparent' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'}`}
                            aria-label={`为账号 ${acc.name} 续费周期`}
                          >
                            <RefreshCw size={13} />
                          </Button>
                          <Button
                            id={`account-toggle-${acc.id}`}
                            onClick={() => handleToggle(acc)}
                            title={acc.status === 'disabled' ? '启用' : '停用'}
                            variant="ghost"
                            className={`h-8 w-8 p-0 ${acc.status === 'disabled' ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                            aria-label={acc.status === 'disabled' ? `启用账号 ${acc.name}` : `停用账号 ${acc.name}`}
                          >
                            {acc.status === 'disabled' ? <Play size={13} /> : <Power size={13} />}
                          </Button>
                          <Button
                            id={`account-edit-${acc.id}`}
                            onClick={() => setEditingAcc({ ...acc })}
                            title="修改账号"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            aria-label={`编辑修改账号 ${acc.name}`}
                          >
                            <Edit size={13} />
                          </Button>
                          <Button
                            id={`account-delete-${acc.id}`}
                            onClick={() => openDelete(acc)}
                            title="删除账号"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            aria-label={`彻底删除账号 ${acc.name}`}
                          >
                            <Trash size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-bold text-zinc-100">新建账号</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-account-name" className="text-xs text-zinc-400">账号名称</Label>
              <Input
                id="create-account-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11 text-zinc-200"
                placeholder="例: OpenAI-主力账号"
              />
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-account-amount" className="text-xs text-zinc-400">首期充值金额 (元)</Label>
                <Input
                  id="create-account-amount"
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11 text-zinc-200 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-account-weeks-select" className="text-xs text-zinc-400">配置周数</Label>
                <Select
                  id="create-account-weeks-select"
                  value={newWeeks}
                  onChange={setNewWeeks}
                  options={[2,3,4,5,6,7,8].map(w => ({ value: w, label: `${w} 周` }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              周期预算配置：按配置周数平摊 = {Number(newAmount) > 0 && Number(newWeeks) > 0 ? fmt(Number(newAmount) / Number(newWeeks)) : '—'} / 周
            </p>
            
            <div className="border-t border-zinc-800 pt-3 mt-2">
              <Label className="block text-xs font-bold text-zinc-300 mb-2">线上额度查询配置</Label>
              <div className="space-y-3 bg-zinc-950/45 p-3 rounded-xl border border-zinc-800/60">
                <div className="space-y-1">
                  <Label htmlFor="create-account-api-type" className="text-[11px] text-zinc-400">查询源类型</Label>
                  <Select
                    id="create-account-api-type"
                    value={newApiType}
                    onChange={(val) => {
                      setNewApiType(val);
                      if (val === 'codex' && !newApiUrl) {
                        setNewApiUrl('https://chatgpt.com');
                      }
                    }}
                    options={[
                      { value: 'disabled', label: '不启用' },
                      { value: 'codex', label: 'Codex (ChatGPT) 官方接口' }
                    ]}
                  />
                </div>
                 {newApiType === 'codex' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="create-account-api-url" className="text-[11px] text-zinc-400">API 基础地址</Label>
                      <Input
                        id="create-account-api-url"
                        type="text"
                        value={newApiUrl}
                        onChange={(e) => setNewApiUrl(e.target.value)}
                        required
                        className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-xs h-9 text-zinc-300"
                        placeholder="https://chatgpt.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="create-account-api-session-token" className="text-[11px] font-semibold text-blue-400">Session Cookie</Label>
                        <span className="relative group inline-block cursor-help">
                          <HelpCircle className="text-zinc-500 hover:text-blue-400 transition-colors" size={13} />
                          <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-72 bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] font-normal p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl z-50 leading-relaxed scale-95 group-hover:scale-100 origin-bottom-right">
                            <span className="font-semibold text-blue-400 block mb-1">Session Cookie 配置说明</span>
                            登录 ChatGPT 后，按 F12 打开开发者工具 ➔ Application ➔ Cookies ➔ <code>https://chatgpt.com</code>，复制 <code>__Secure-next-auth.session-token</code> 的值。
                            <hr className="border-zinc-800 my-1.5" />
                            <span className="font-semibold text-amber-400 block mb-1">💡 关于 .0 和 .1 分片 Cookie</span>
                            如果包含 <code>.0</code> 和 <code>.1</code> 后缀的 cookie 键，<strong>请务必连同键名完整粘贴</strong>，或者直接粘贴浏览器请求头里整段 <code>Cookie</code> 内容。
                          </span>
                        </span>
                      </div>
                      <textarea
                        id="create-account-api-session-token"
                        value={newApiSessionToken}
                        onChange={(e) => setNewApiSessionToken(e.target.value)}
                        rows={2}
                        className="w-full text-xs font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none"
                        placeholder="粘贴 __Secure-next-auth.session-token Cookie 值..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-account-api-key" className="text-[11px] text-zinc-400">Access Token (如果填了 Session Cookie，此项可选填)</Label>
                      <textarea
                        id="create-account-api-key"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        rows={2}
                        className="w-full text-xs font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none"
                        placeholder="ey..."
                      />
                      <p className="text-[9px] text-zinc-500 leading-normal">
                        提示：登录后可在 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">https://chatgpt.com/api/auth/session</a> 获取。
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-account-api-account-id" className="text-[11px] text-zinc-400">ChatGPT 账号 ID (可选，用于团队/工作空间账号)</Label>
                      <Input
                        id="create-account-api-account-id"
                        type="text"
                        value={newApiAccountId}
                        onChange={(e) => setNewApiAccountId(e.target.value)}
                        className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-xs h-9 text-zinc-300"
                        placeholder="例: g-xxx / personal-xxx"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-zinc-800 pt-4">
              <Button
                id="create-account-cancel-btn"
                type="button"
                onClick={() => setShowCreate(false)}
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold"
                aria-label="取消创建账号"
              >
                取消
              </Button>
              <Button
                id="create-account-submit-btn"
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold"
                aria-label="确定并创建账号"
              >
                确认创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recharge Modal */}
      <Dialog open={showRecharge} onOpenChange={setShowRecharge}>
        <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100">账号续费</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecharge} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recharge-amount" className="text-xs text-zinc-400">充值金额 (元)</Label>
                <Input
                  id="recharge-amount"
                  type="number"
                  value={rechargeAmt}
                  onChange={(e) => setRechargeAmt(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11 text-zinc-200 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recharge-weeks-select" className="text-xs text-zinc-400">配置周数</Label>
                <Select
                  id="recharge-weeks-select"
                  value={rechargeWeeks}
                  onChange={setRechargeWeeks}
                  options={[2,3,4,5,6,7,8].map(w => ({ value: w, label: `${w} 周` }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              周期预算平摊 = {fmt(Number(rechargeAmt) / Number(rechargeWeeks))} / 周
            </p>
            <DialogFooter className="border-t border-zinc-800 pt-4">
              <Button
                id="recharge-cancel-btn"
                type="button"
                onClick={() => setShowRecharge(false)}
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold"
                aria-label="取消账号续费"
              >
                取消
              </Button>
              <Button
                id="recharge-submit-btn"
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold"
                aria-label="确认账号续费"
              >
                确认续费
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit name Modal */}
      <Dialog open={!!editingAcc} onOpenChange={(open) => { if (!open) setEditingAcc(null) }}>
        {editingAcc && (
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-zinc-800 bg-zinc-900 p-5 text-zinc-100 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-100">配置账号参数</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-account-name" className="text-xs text-zinc-400">账号名称</Label>
                <Input
                  id="edit-account-name"
                  type="text"
                  value={editingAcc.name}
                  onChange={(e) => setEditingAcc({ ...editingAcc, name: e.target.value })}
                  required
                  className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-sm h-11 text-zinc-200"
                />
              </div>

              <div className="border-t border-zinc-800 pt-3 mt-2">
                <Label className="block text-xs font-bold text-zinc-300 mb-2">线上额度查询配置</Label>
                <div className="space-y-3 bg-zinc-950/45 p-3 rounded-xl border border-zinc-800/60">
                  <div className="space-y-1">
                    <Label htmlFor="edit-account-api-type" className="text-[11px] text-zinc-400">查询源类型</Label>
                    <Select
                      id="edit-account-api-type"
                      value={editingAcc.api_type || 'disabled'}
                      onChange={(val) => {
                        const updated = { ...editingAcc, api_type: val };
                        if (val === 'codex' && !updated.api_url) {
                          updated.api_url = 'https://chatgpt.com';
                        }
                        setEditingAcc(updated);
                      }}
                      options={[
                        { value: 'disabled', label: '不启用' },
                        { value: 'codex', label: 'Codex (ChatGPT) 官方接口' }
                      ]}
                    />
                  </div>
                   {editingAcc.api_type === 'codex' && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="edit-account-api-url" className="text-[11px] text-zinc-400">API 基础地址</Label>
                        <Input
                          id="edit-account-api-url"
                          type="text"
                          value={editingAcc.api_url || ''}
                          onChange={(e) => setEditingAcc({ ...editingAcc, api_url: e.target.value })}
                          required
                          className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-xs h-9 text-zinc-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit-account-api-session-token" className="text-[11px] font-semibold text-blue-400">Session Cookie (留空不修改)</Label>
                          <span className="relative group inline-block cursor-help">
                            <HelpCircle className="text-zinc-500 hover:text-blue-400 transition-colors" size={13} />
                            <span className="pointer-events-none absolute bottom-full right-0 mb-2 w-72 bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] font-normal p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl z-50 leading-relaxed scale-95 group-hover:scale-100 origin-bottom-right">
                              <span className="font-semibold text-blue-400 block mb-1">Session Cookie 配置说明</span>
                              登录 ChatGPT ➔ Cookies ➔ 复制 <code>__Secure-next-auth.session-token</code>。
                            </span>
                          </span>
                        </div>
                        <textarea
                          id="edit-account-api-session-token"
                          value={editingAcc.api_session_token || ''}
                          onChange={(e) => setEditingAcc({ ...editingAcc, api_session_token: e.target.value })}
                          rows={2}
                          className="w-full text-xs font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none"
                          placeholder="若需清除请输入空串，否则留空表示不修改..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-account-api-key" className="text-[11px] text-zinc-400">Access Token (留空不修改)</Label>
                        <textarea
                          id="edit-account-api-key"
                          value={editingAcc.api_key || ''}
                          onChange={(e) => setEditingAcc({ ...editingAcc, api_key: e.target.value })}
                          rows={2}
                          className="w-full text-xs font-mono p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none"
                          placeholder="若需清除请输入空串，否则留空表示不修改..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-account-api-account-id" className="text-[11px] text-zinc-400">ChatGPT 账号 ID (可选)</Label>
                        <Input
                          id="edit-account-api-account-id"
                          type="text"
                          value={editingAcc.api_account_id || ''}
                          onChange={(e) => setEditingAcc({ ...editingAcc, api_account_id: e.target.value })}
                          className="bg-zinc-800/30 border-zinc-800 focus-visible:ring-blue-500/30 text-xs h-9 text-zinc-300"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t border-zinc-800 pt-4">
                <Button
                  id="edit-account-cancel-btn"
                  type="button"
                  onClick={() => setEditingAcc(null)}
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold text-xs"
                  aria-label="取消保存配置"
                >
                  取消
                </Button>
                <Button
                  id="edit-account-submit-btn"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-zinc-100 font-semibold text-xs h-9"
                  aria-label="确定并保存账号参数"
                >
                  保存配置
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete confirm Modal */}
      <Dialog open={!!deleteInfo} onOpenChange={(open) => { if (!open) setDeleteInfo(null) }}>
        {deleteInfo && (
          <DialogContent className="max-w-sm border-zinc-800 bg-zinc-900 p-5 text-center text-zinc-100 sm:p-6">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={22} />
            </div>
            <DialogTitle className="text-base font-bold text-zinc-100 mb-1 justify-center flex">确认删除账号？</DialogTitle>
            <p className="text-xs text-zinc-400 mb-2">
              即将删除：<span className="font-semibold text-zinc-200">「{deleteInfo.account_name}」</span>
            </p>
            <p className="text-[11px] text-rose-400/90 leading-relaxed mb-6">
              将同时删除 {deleteInfo.cycle_count} 个计费周期、{deleteInfo.record_count} 条账单流水，此操作<strong>不可撤销</strong>！
            </p>
            <DialogFooter className="flex-row justify-center gap-2 border-t border-zinc-800 pt-4">
              <Button
                id="delete-account-cancel-btn"
                onClick={() => setDeleteInfo(null)}
                variant="ghost"
                className="flex-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 font-semibold text-xs h-9 rounded-xl"
                aria-label="取消删除账号"
              >
                取消
              </Button>
              <Button
                id="delete-account-confirm-btn"
                onClick={handleDelete}
                variant="destructive"
                className="flex-1 font-semibold text-xs h-9 rounded-xl"
                aria-label="确认彻底删除账号"
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
