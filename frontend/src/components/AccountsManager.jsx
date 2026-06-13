import { useState, useEffect, useCallback } from 'react'
import Select from './Select'
import {
  Plus, RefreshCw, Play, Power, Edit, Trash, AlertCircle, CheckCircle2, HelpCircle,
} from 'lucide-react'
import { accountsApi } from '../api/client'

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v ?? 0)

function Toast({ msg }) {
  if (!msg.text) return null
  return (
    <div className={`p-4 rounded-xl flex items-center space-x-2 ${msg.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
      {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="font-medium text-sm">{msg.text}</span>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-in">
        <h3 className="text-xl font-bold mb-5 text-slate-800">{title}</h3>
        {children}
      </div>
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

  return (
    <div className="space-y-5">
      <Toast msg={msg} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">账号与充值</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={17} /><span>新建账号</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm animate-pulse">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['账号名称', '当前期数', '账号状态', '当前周状态', '本期周预算', '操作'].map((h, i) => (
                    <th key={h} className={`px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {accounts.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">暂无账号，请新建</td></tr>
                )}
                {accounts.map((acc) => {
                  const cycle = acc.active_cycle
                  const isOverdue = cycle?.is_overdue
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{acc.name}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                        {cycle ? `第 ${cycle.cycle_number} 期` : '无活跃周期'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${acc.status === 'disabled' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-800'}`}>
                          {acc.status === 'disabled' ? '已停用' : '使用中'}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {cycle ? (
                          isOverdue
                            ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">第 {cycle.current_week_num} 业务周（超配置）</span>
                            : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">第 {cycle.current_week_num} 业务周</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">已归档</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                        {cycle ? fmt(cycle.weekly_budget) : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right space-x-1.5">
                        <button
                          onClick={() => { setTargetAccId(acc.id); setShowRecharge(true) }}
                          disabled={acc.status === 'disabled'}
                          title="续费新周期"
                          className={`p-1.5 rounded-lg transition-colors ${acc.status === 'disabled' ? 'text-slate-300 bg-slate-50 cursor-not-allowed' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                        ><RefreshCw size={15} /></button>
                        <button
                          onClick={() => handleToggle(acc)}
                          title={acc.status === 'disabled' ? '启用' : '停用'}
                          className={`p-1.5 rounded-lg transition-colors ${acc.status === 'disabled' ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`}
                        >{acc.status === 'disabled' ? <Play size={15} /> : <Power size={15} />}</button>
                        <button
                          onClick={() => setEditingAcc({ ...acc })}
                          title="修改名称"
                          className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                        ><Edit size={15} /></button>
                        <button
                          onClick={() => openDelete(acc)}
                          title="删除账号"
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                        ><Trash size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="新建账号" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">账号名称</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required className="form-input" placeholder="例: ChatGPT-主账号" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">首期充值金额 (元)</label>
                <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} required min="0.01" step="0.01" className="form-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">配置周数 (2-8)</label>
                <Select
                  value={newWeeks}
                  onChange={setNewWeeks}
                  options={[2,3,4,5,6,7,8].map(w => ({ value: w, label: `${w} 周` }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              周预算按配置周数平均 = {Number(newAmount) > 0 && Number(newWeeks) > 0 ? fmt(Number(newAmount) / Number(newWeeks)) : '—'} / 周
            </p>
            
            <div className="border-t border-slate-100 pt-3 mt-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">自动额度查询</label>
              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">查询方式</label>
                  <Select
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
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">API 基础地址</label>
                      <input type="text" value={newApiUrl} onChange={(e) => setNewApiUrl(e.target.value)} required className="form-input text-xs" placeholder="https://chatgpt.com" />
                    </div>
                    <div>
                      <div className="flex items-center mb-1">
                        <label className="block text-xs font-semibold text-blue-700">Session Cookie (__Secure-next-auth.session-token)</label>
                        <span className="relative group inline-block ml-1.5 cursor-help align-middle">
                          <HelpCircle className="text-slate-400 hover:text-blue-500 transition-colors" size={14} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-900/95 backdrop-blur text-white text-[11px] font-normal p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl z-50 leading-relaxed scale-95 group-hover:scale-100 origin-bottom">
                            <span className="font-semibold text-blue-300 block mb-1">Session Cookie 配置说明</span>
                            登录 ChatGPT 后，按 F12 打开开发者工具 ➔ Application (应用) / Storage (存储) ➔ Cookies ➔ <code>https://chatgpt.com</code>，复制 <code>__Secure-next-auth.session-token</code> 的值。<strong>配置后后台会自动帮您刷新 Access Token</strong>。
                            <hr className="border-slate-700 my-1.5" />
                            <span className="font-semibold text-amber-300 block mb-1">💡 关于 .0 和 .1 分片 Cookie</span>
                            如果含有 <code>.0</code> 和 <code>.1</code>，<strong>两者必须同时提供</strong>以避免查询额度返回 401：
                            <ul className="list-disc pl-3.5 space-y-1 mt-1 text-slate-300">
                              <li><strong>方式一：</strong>拼接两个键值对粘贴，如：<code>__Secure-next-auth.session-token.0=xxx; __Secure-next-auth.session-token.1=yyy</code></li>
                              <li><strong>方式二：</strong>直接复制浏览器网络请求（Request Headers）中整段 <code>Cookie</code> 粘贴，系统会自动识别提取。</li>
                            </ul>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></span>
                          </span>
                        </span>
                      </div>
                      <textarea value={newApiSessionToken} onChange={(e) => setNewApiSessionToken(e.target.value)} rows={2} className="form-input text-xs font-mono border-blue-200 focus:border-blue-500" placeholder="粘贴 __Secure-next-auth.session-token Cookie 值..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Access Token (如果填了 Session Cookie，此项可不填)</label>
                      <textarea value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} rows={2} className="form-input text-xs font-mono" placeholder="ey..." />
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        提示：请先在浏览器登录 ChatGPT，访问 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://chatgpt.com/api/auth/session</a>，复制返回的 JSON 数据中 <code>accessToken</code> 的值并填入此处。
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">ChatGPT 账号 ID (可选，用于团队账号)</label>
                      <input type="text" value={newApiAccountId} onChange={(e) => setNewApiAccountId(e.target.value)} className="form-input text-xs" placeholder="例如: g-xxx / personal-xxx" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors text-sm">取消</button>
              <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">确认创建</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Recharge Modal */}
      {showRecharge && (
        <Modal title="账号续费" onClose={() => setShowRecharge(false)}>
          <form onSubmit={handleRecharge} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">充值金额 (元)</label>
                <input type="number" value={rechargeAmt} onChange={(e) => setRechargeAmt(e.target.value)} required min="0.01" step="0.01" className="form-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">配置周数 (2-8)</label>
                <Select
                  value={rechargeWeeks}
                  onChange={setRechargeWeeks}
                  options={[2,3,4,5,6,7,8].map(w => ({ value: w, label: `${w} 周` }))}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              续费后周预算按配置周数平均 = {fmt(Number(rechargeAmt) / Number(rechargeWeeks))} / 周
            </p>
            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={() => setShowRecharge(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors text-sm">取消</button>
              <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">确认续费</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit name Modal */}
      {editingAcc && (
        <Modal title="修改账号名称" onClose={() => setEditingAcc(null)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">账号名称</label>
              <input type="text" value={editingAcc.name} onChange={(e) => setEditingAcc({ ...editingAcc, name: e.target.value })} required className="form-input" />
            </div>

            <div className="border-t border-slate-100 pt-3 mt-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">自动额度查询</label>
              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">查询方式</label>
                  <Select
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
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">API 基础地址</label>
                      <input type="text" value={editingAcc.api_url || ''} onChange={(e) => setEditingAcc({ ...editingAcc, api_url: e.target.value })} required className="form-input text-xs" placeholder="https://chatgpt.com" />
                    </div>
                    <div>
                      <div className="flex items-center mb-1">
                        <label className="block text-xs font-semibold text-blue-700">Session Cookie (__Secure-next-auth.session-token) (留空不修改 / 输入空串可清除)</label>
                        <span className="relative group inline-block ml-1.5 cursor-help align-middle">
                          <HelpCircle className="text-slate-400 hover:text-blue-500 transition-colors" size={14} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-900/95 backdrop-blur text-white text-[11px] font-normal p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl z-50 leading-relaxed scale-95 group-hover:scale-100 origin-bottom">
                            <span className="font-semibold text-blue-300 block mb-1">Session Cookie 配置说明</span>
                            登录 ChatGPT 后，按 F12 打开开发者工具 ➔ Application (应用) / Storage (存储) ➔ Cookies ➔ <code>https://chatgpt.com</code>，复制 <code>__Secure-next-auth.session-token</code> 的值。<strong>配置后后台会自动帮您刷新 Access Token</strong>。
                            <hr className="border-slate-700 my-1.5" />
                            <span className="font-semibold text-amber-300 block mb-1">💡 关于 .0 和 .1 分片 Cookie</span>
                            如果含有 <code>.0</code> 和 <code>.1</code>，<strong>两者必须同时提供</strong>以避免查询额度返回 401：
                            <ul className="list-disc pl-3.5 space-y-1 mt-1 text-slate-300">
                              <li><strong>方式一：</strong>拼接两个键值对粘贴，如：<code>__Secure-next-auth.session-token.0=xxx; __Secure-next-auth.session-token.1=yyy</code></li>
                              <li><strong>方式二：</strong>直接复制浏览器网络请求（Request Headers）中整段 <code>Cookie</code> 粘贴，系统会自动识别提取。</li>
                            </ul>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95"></span>
                          </span>
                        </span>
                      </div>
                      <textarea value={editingAcc.api_session_token || ''} onChange={(e) => setEditingAcc({ ...editingAcc, api_session_token: e.target.value })} rows={2} className="form-input text-xs font-mono border-blue-200 focus:border-blue-500" placeholder="粘贴 __Secure-next-auth.session-token Cookie 值..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Access Token (留空不修改 / 输入空串可清除)</label>
                      <textarea value={editingAcc.api_key || ''} onChange={(e) => setEditingAcc({ ...editingAcc, api_key: e.target.value })} rows={2} className="form-input text-xs font-mono" placeholder="ey..." />
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        提示：请先在浏览器登录 ChatGPT，访问 <a href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://chatgpt.com/api/auth/session</a>，复制返回的 <code>accessToken</code> 值。
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">ChatGPT 账号 ID (可选，用于团队账号)</label>
                      <input type="text" value={editingAcc.api_account_id || ''} onChange={(e) => setEditingAcc({ ...editingAcc, api_account_id: e.target.value })} className="form-input text-xs" placeholder="例如: g-xxx / personal-xxx" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={() => setEditingAcc(null)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm">取消</button>
              <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm">保存</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm Modal */}
      {deleteInfo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center animate-in">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">确认删除账号？</h3>
            <p className="text-sm text-slate-500 mb-1">
              即将删除：<span className="font-semibold text-slate-800">「{deleteInfo.account_name}」</span>
            </p>
            <p className="text-xs text-rose-500 mb-6">
              将同时删除 {deleteInfo.cycle_count} 个周期、{deleteInfo.record_count} 条流水，且<strong>不可恢复</strong>。
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteInfo(null)} className="flex-1 px-4 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-medium text-sm">取消</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-medium text-sm">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
