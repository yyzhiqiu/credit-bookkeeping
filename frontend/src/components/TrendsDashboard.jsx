import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"
import { accountsApi, recordsApi } from "../api/client"
import Select from "./Select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const fmtMoney = (value) => new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
}).format(value || 0)

const fmtNumber = (value, digits = 2) => Number(value || 0).toFixed(digits)

const parseRecordDate = (value) => {
  if (!value) return new Date(0)
  return new Date(value.endsWith("Z") ? value : `${value}Z`)
}

const dateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const shortDate = (value) => {
  const date = new Date(`${value}T00:00:00`)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const shortAccountName = (value) => {
  if (!value) return "账号"
  const emailName = value.split("@")[0]
  return emailName.length > 12 ? `${emailName.slice(0, 12)}…` : emailName
}

const spendChartConfig = {
  dailySpend: {
    label: "当日扣费",
    color: "#3b82f6",
  },
  cumulativeSpend: {
    label: "累计扣费",
    color: "#8b5cf6",
  },
}

const remainingChartConfig = {
  remaining: {
    label: "平均剩余额度",
    color: "#10b981",
  },
  consumed: {
    label: "当日消耗比例",
    color: "#f43f5e",
  },
}

const weeklyChartConfig = {
  amount: {
    label: "周扣费",
    color: "#06b6d4",
  },
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "blue", change }) {
  const toneClasses = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-400",
  }

  return (
    <Card className="gap-0 border-zinc-800/70 bg-zinc-900/35 py-0 shadow-lg backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</p>
            <p className="mt-2 truncate text-xl font-extrabold text-zinc-100">{value}</p>
          </div>
          <div className={`rounded-xl border p-2.5 ${toneClasses[tone]}`}>
            <Icon size={18} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
          <span className="truncate text-zinc-500">{subtitle}</span>
          {change !== null && change !== undefined && (
            <Badge
              variant="outline"
              className={change <= 0
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                : "border-rose-500/20 bg-rose-500/5 text-rose-400"}
            >
              {change > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {change > 0 ? "+" : ""}{fmtNumber(change, 1)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ text }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-zinc-500">
        <BarChart3 size={24} />
      </div>
      <p className="text-xs text-zinc-500">{text}</p>
    </div>
  )
}

export default function TrendsDashboard() {
  const [records, setRecords] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [accountId, setAccountId] = useState("all")
  const [range, setRange] = useState("90")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [recordsRes, accountsRes] = await Promise.all([
        recordsApi.list(),
        accountsApi.list(),
      ])
      setRecords(recordsRes.data)
      setAccounts(accountsRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || "趋势数据加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const analytics = useMemo(() => {
    const accountRecords = records
      .filter((record) => accountId === "all" || record.account_id === accountId)
      .map((record) => ({ ...record, parsedDate: parseRecordDate(record.created_at) }))
      .sort((a, b) => a.parsedDate - b.parsedDate)

    const latestDate = accountRecords.length
      ? accountRecords[accountRecords.length - 1].parsedDate
      : new Date()
    const rangeDays = range === "all" ? null : Number(range)
    const cutoff = rangeDays
      ? new Date(latestDate.getTime() - (rangeDays - 1) * 86400000)
      : null
    const filtered = cutoff
      ? accountRecords.filter((record) => record.parsedDate >= cutoff)
      : accountRecords

    const previousCutoff = rangeDays
      ? new Date(cutoff.getTime() - rangeDays * 86400000)
      : null
    const previous = rangeDays
      ? accountRecords.filter((record) => record.parsedDate >= previousCutoff && record.parsedDate < cutoff)
      : []

    const dailyMap = new Map()
    filtered.forEach((record) => {
      const key = dateKey(record.parsedDate)
      const current = dailyMap.get(key) || {
        date: key,
        dailySpend: 0,
        consumed: 0,
        remainingTotal: 0,
        count: 0,
      }
      current.dailySpend += Number(record.consumed_amount || 0)
      current.consumed += Number(record.consumed_pct || 0)
      current.remainingTotal += Number(record.remaining_pct || 0)
      current.count += 1
      dailyMap.set(key, current)
    })

    let cumulativeSpend = 0
    const daily = [...dailyMap.values()].map((item) => {
      cumulativeSpend += item.dailySpend
      return {
        ...item,
        label: shortDate(item.date),
        dailySpend: Number(item.dailySpend.toFixed(2)),
        cumulativeSpend: Number(cumulativeSpend.toFixed(2)),
        consumed: Number(item.consumed.toFixed(2)),
        remaining: Number((item.remainingTotal / item.count).toFixed(2)),
      }
    })

    const weekMap = new Map()
    filtered.forEach((record) => {
      const key = `${record.account_id}-${record.week_number}`
      const current = weekMap.get(key) || {
        label: `${shortAccountName(record.account_name)} · 第${record.week_number}周`,
        fullLabel: `${record.account_name || "账号"} · 第${record.week_number}周`,
        amount: 0,
        count: 0,
      }
      current.amount += Number(record.consumed_amount || 0)
      current.count += 1
      weekMap.set(key, current)
    })
    const weekly = [...weekMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((item) => ({ ...item, amount: Number(item.amount.toFixed(2)) }))

    const accountMap = new Map()
    filtered.forEach((record) => {
      const current = accountMap.get(record.account_id) || {
        id: record.account_id,
        name: record.account_name || "未命名账号",
        amount: 0,
        consumed: 0,
        count: 0,
        latestRemaining: 100,
        latestDate: new Date(0),
      }
      current.amount += Number(record.consumed_amount || 0)
      current.consumed += Number(record.consumed_pct || 0)
      current.count += 1
      if (record.parsedDate >= current.latestDate) {
        current.latestDate = record.parsedDate
        current.latestRemaining = Number(record.remaining_pct || 0)
      }
      accountMap.set(record.account_id, current)
    })
    const ranking = [...accountMap.values()].sort((a, b) => b.amount - a.amount)

    const totalSpend = filtered.reduce((sum, record) => sum + Number(record.consumed_amount || 0), 0)
    const previousSpend = previous.reduce((sum, record) => sum + Number(record.consumed_amount || 0), 0)
    const change = rangeDays && previousSpend > 0
      ? ((totalSpend - previousSpend) / previousSpend) * 100
      : null
    const activeDays = new Set(filtered.map((record) => dateKey(record.parsedDate))).size
    const averageDaily = activeDays ? totalSpend / activeDays : 0
    const averageRemaining = filtered.length
      ? filtered.reduce((sum, record) => sum + Number(record.remaining_pct || 0), 0) / filtered.length
      : 0

    return {
      filtered,
      daily,
      weekly,
      ranking,
      totalSpend,
      averageDaily,
      averageRemaining,
      activeDays,
      change,
      topAccount: ranking[0],
    }
  }, [records, accountId, range])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="text-sm font-medium text-zinc-400">正在聚合趋势数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12">
        <AlertCircle size={32} className="text-rose-500" />
        <p className="text-sm font-semibold text-rose-400">{error}</p>
        <Button variant="outline" onClick={load} className="border-zinc-800 text-zinc-300">
          <RefreshCw size={14} />
          重新加载
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-zinc-50">消耗趋势看板</h2>
            <Badge variant="outline" className="border-blue-500/20 bg-blue-500/5 text-blue-400">
              实时聚合
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-400">分析额度消耗、扣费变化与账号使用强度</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[220px_170px]">
          <Select
            value={accountId}
            onChange={setAccountId}
            options={[
              { value: "all", label: "全部账号" },
              ...accounts.map((account) => ({ value: account.id, label: account.name })),
            ]}
          />
          <Select
            value={range}
            onChange={setRange}
            options={[
              { value: "30", label: "近 30 天" },
              { value: "90", label: "近 90 天" },
              { value: "180", label: "近 180 天" },
              { value: "all", label: "全部时间" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="区间总扣费"
          value={fmtMoney(analytics.totalSpend)}
          subtitle={`${analytics.filtered.length} 笔消耗记录`}
          icon={CircleDollarSign}
          tone="blue"
          change={analytics.change}
        />
        <StatCard
          title="活跃日均扣费"
          value={fmtMoney(analytics.averageDaily)}
          subtitle={`${analytics.activeDays} 个活跃记账日`}
          icon={Activity}
          tone="violet"
        />
        <StatCard
          title="平均剩余额度"
          value={`${fmtNumber(analytics.averageRemaining, 1)}%`}
          subtitle="基于筛选区间内所有记录"
          icon={Target}
          tone="emerald"
        />
        <StatCard
          title="消耗最高账号"
          value={analytics.topAccount?.name || "暂无数据"}
          subtitle={analytics.topAccount ? fmtMoney(analytics.topAccount.amount) : "尚无消耗记录"}
          icon={TrendingUp}
          tone="rose"
        />
      </div>

      <Tabs defaultValue="spend" className="w-full min-w-0 flex-col gap-5 pt-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-full bg-zinc-900/70 p-1 sm:w-auto">
            <TabsTrigger value="spend" className="px-3 text-xs">扣费趋势</TabsTrigger>
            <TabsTrigger value="quota" className="px-3 text-xs">额度趋势</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <CalendarRange size={13} />
            图表按实际记账日期聚合
          </div>
        </div>

        <TabsContent value="spend" className="w-full min-w-0">
          <Card className="w-full min-w-0 gap-6 bg-zinc-900/35 py-6 shadow-lg shadow-black/5 ring-0 backdrop-blur-xl">
            <CardHeader className="px-6 pb-0">
              <CardTitle className="text-sm font-bold text-zinc-100">每日扣费与累计支出</CardTitle>
              <CardDescription className="text-xs">柱状图为当日扣费，折线为区间累计扣费</CardDescription>
            </CardHeader>
            <CardContent className="px-6">
              {analytics.daily.length ? (
                <ChartContainer config={spendChartConfig} className="h-[360px] w-full aspect-auto">
                  <ComposedChart data={analytics.daily} margin={{ top: 20, right: 12, left: -14, bottom: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value}`} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={(value) => `¥${value}`} />
                    <ChartTooltip
                      cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
                      content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} />}
                    />
                    <Bar yAxisId="left" dataKey="dailySpend" fill="var(--color-dailySpend)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeSpend" stroke="var(--color-cumulativeSpend)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ChartContainer>
              ) : (
                <EmptyChart text="当前筛选范围内暂无扣费记录" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quota" className="w-full min-w-0">
          <Card className="w-full min-w-0 gap-6 bg-zinc-900/35 py-6 shadow-lg shadow-black/5 ring-0 backdrop-blur-xl">
            <CardHeader className="px-6 pb-0">
              <CardTitle className="text-sm font-bold text-zinc-100">剩余额度与消耗强度</CardTitle>
              <CardDescription className="text-xs">面积图为记录时平均剩余，折线为当日累计消耗比例</CardDescription>
            </CardHeader>
            <CardContent className="px-6">
              {analytics.daily.length ? (
                <ChartContainer config={remainingChartConfig} className="h-[360px] w-full aspect-auto">
                  <AreaChart data={analytics.daily} margin={{ top: 20, right: 12, left: -14, bottom: 4 }}>
                    <defs>
                      <linearGradient id="remainingFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-remaining)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-remaining)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} />} />
                    <Area type="monotone" dataKey="remaining" stroke="var(--color-remaining)" fill="url(#remainingFill)" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="consumed" stroke="var(--color-consumed)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <EmptyChart text="当前筛选范围内暂无额度记录" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-8 pt-3">
        <Card className="gap-6 bg-zinc-900/25 py-6 shadow-lg shadow-black/5 ring-0 backdrop-blur-xl">
          <CardHeader className="px-6 pb-0">
            <CardTitle className="text-sm font-bold text-zinc-100">账号消耗排名</CardTitle>
            <CardDescription className="text-xs">按筛选区间内实际扣费金额排序</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-6">
            {analytics.ranking.length ? analytics.ranking.map((item, index) => {
              const maxAmount = analytics.ranking[0]?.amount || 1
              const width = Math.max(4, (item.amount / maxAmount) * 100)
              return (
                <div key={item.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 text-[10px] font-bold text-zinc-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-200">{item.name}</p>
                        <p className="mt-0.5 text-[9px] text-zinc-500">{item.count} 笔记录 · 最新剩余 {fmtNumber(item.latestRemaining, 1)}%</p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-bold text-rose-400">{fmtMoney(item.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-950">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            }) : (
              <EmptyChart text="暂无账号消耗数据" />
            )}
          </CardContent>
        </Card>

        <Card className="gap-6 bg-zinc-900/35 py-6 shadow-lg shadow-black/5 ring-0 backdrop-blur-xl">
          <CardHeader className="px-6 pb-0">
            <CardTitle className="text-sm font-bold text-zinc-100">高消耗业务周</CardTitle>
            <CardDescription className="text-xs">展示扣费最高的前 10 个账号业务周</CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            {analytics.weekly.length ? (
              <ChartContainer config={weeklyChartConfig} className="h-[340px] w-full aspect-auto">
                <BarChart data={analytics.weekly} layout="vertical" margin={{ top: 6, right: 18, left: 10, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={132}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ""} />}
                  />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 5, 5, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChart text="暂无业务周消耗数据" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
