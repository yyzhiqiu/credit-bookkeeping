import { useState, useEffect } from 'react'
import { LayoutDashboard, CreditCard, List, AlertCircle, RefreshCw } from 'lucide-react'
import { accountsApi } from '../api/client'

const fmt = (v) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(v)

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

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

  useEffect(() => { load() }, [])

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
                    <span className="text-emerald-600">剩余: {item.current_remaining_pct}%</span>
                    <span className="text-slate-400">100%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
