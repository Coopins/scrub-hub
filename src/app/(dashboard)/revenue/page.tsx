'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Download, TrendingUp, CreditCard, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

type PaymentRow = {
  id: string
  service_type: string
  scheduled_datetime: string
  amount_paid: number
  payment_method: string | null
  payment_status: string
  paid_at: string | null
  client: { first_name: string; last_name: string } | null
  pet: { name: string } | null
}

type OutstandingRow = {
  id: string
  service_type: string
  scheduled_datetime: string
  price: number | null
  amount_paid: number | null
  payment_status: string
  client: { first_name: string; last_name: string } | null
  pet: { name: string } | null
}

const METHOD_LABELS: Record<string, string> = {
  cash: '💵 Cash',
  card: '💳 Card',
  venmo: '📱 Venmo',
  zelle: '📲 Zelle',
  other: 'Other',
}

function startOfDay(d: Date)   { const r = new Date(d); r.setHours(0, 0, 0, 0); return r }
function startOfWeek(d: Date)  { const r = new Date(d); r.setDate(d.getDate() - d.getDay()); r.setHours(0, 0, 0, 0); return r }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) }

export default function RevenuePage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  })
  const now = new Date()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: paidData }, { data: owedData }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, service_type, scheduled_datetime, amount_paid, payment_method, payment_status, paid_at, client:clients(first_name, last_name), pet:pets(name)')
          .eq('groomer_id', user.id)
          .eq('status', 'completed')
          .not('amount_paid', 'is', null)
          .gte('scheduled_datetime', startOfMonth(viewDate).toISOString())
          .lte('scheduled_datetime', endOfMonth(viewDate).toISOString())
          .order('scheduled_datetime', { ascending: false }),
        supabase
          .from('appointments')
          .select('id, service_type, scheduled_datetime, price, amount_paid, payment_status, client:clients(first_name, last_name), pet:pets(name)')
          .eq('groomer_id', user.id)
          .eq('status', 'completed')
          .in('payment_status', ['unpaid', 'partial'])
          .gte('scheduled_datetime', startOfMonth(viewDate).toISOString())
          .lte('scheduled_datetime', endOfMonth(viewDate).toISOString())
          .order('scheduled_datetime', { ascending: false }),
      ])

      setPayments((paidData ?? []) as unknown as PaymentRow[])
      setOutstanding((owedData ?? []) as unknown as OutstandingRow[])
      setLoading(false)
    }
    load()
  }, [viewDate])

  function sumPayments(filter: (p: PaymentRow) => boolean): number {
    return payments.filter(filter).reduce((acc, p) => acc + (p.amount_paid ?? 0), 0)
  }

  const isCurrentMonth =
    viewDate.getFullYear() === now.getFullYear() &&
    viewDate.getMonth() === now.getMonth()

  const todayTotal = isCurrentMonth
    ? sumPayments(p => new Date(p.scheduled_datetime) >= startOfDay(now))
    : null
  const weekTotal = isCurrentMonth
    ? sumPayments(p => new Date(p.scheduled_datetime) >= startOfWeek(now))
    : null
  const monthTotal = sumPayments(() => true)

  const allMethods = ['cash', 'card', 'venmo', 'zelle', 'other']
  const byMethod = allMethods
    .map(method => ({
      method,
      label: METHOD_LABELS[method] ?? method,
      total: sumPayments(p => p.payment_method === method),
      count: payments.filter(p => p.payment_method === method).length,
    }))
    .filter(m => m.count > 0)

  function navigateMonth(delta: number) {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function exportCSV() {
    const rows: string[][] = [
      ['Date', 'Client', 'Pet', 'Service', 'Amount Paid', 'Payment Method', 'Status'],
      ...payments.map(p => [
        new Date(p.scheduled_datetime).toLocaleDateString(),
        p.client ? `${p.client.first_name} ${p.client.last_name}` : '',
        p.pet?.name ?? '',
        p.service_type.replace('_', ' '),
        p.amount_paid.toFixed(2),
        p.payment_method ?? '',
        p.payment_status,
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `scrub-hub-revenue-${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const statCards = [
    { label: 'Today',      value: todayTotal,  alwaysShow: false },
    { label: 'This Week',  value: weekTotal,   alwaysShow: false },
    { label: monthLabel,   value: monthTotal,  alwaysShow: false },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue</h1>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="text-slate-400 hover:text-white transition-colors p-0.5"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-slate-400 min-w-[130px] text-center">{monthLabel}</p>
            <button
              onClick={() => navigateMonth(1)}
              className="text-slate-400 hover:text-white transition-colors p-0.5"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map(({ label, value, alwaysShow }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="pt-5 pb-4">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide truncate">{label}</p>
              <p className="text-white text-xl font-bold mt-1 tabular-nums">
                {value === null || (!alwaysShow && value === 0) ? '—' : `$${value.toFixed(2)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading…</div>
      ) : payments.length === 0 && outstanding.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No payments recorded for {monthLabel}.
        </div>
      ) : (
        <>
          {/* By payment method */}
          {byMethod.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <CardTitle className="text-white">By Payment Method</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {byMethod.map(m => (
                  <div key={m.method} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-300">{m.label}</span>
                      <span className="text-xs text-slate-500">{m.count} payment{m.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-white font-semibold tabular-nums">${m.total.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold text-slate-300">Total</span>
                  <span className="text-emerald-400 font-bold tabular-nums">${monthTotal.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent payments */}
          {payments.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <CardTitle className="text-white">Recent Payments</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 p-0">
                {payments.map((p, i) => {
                  const dt = new Date(p.scheduled_datetime)
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-6 py-3 ${i !== payments.length - 1 ? 'border-b border-slate-800' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {p.client ? `${p.client.first_name} ${p.client.last_name}` : 'Unknown'}
                          {p.pet ? <span className="text-slate-400 font-normal"> · {p.pet.name}</span> : null}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {p.service_type.replace('_', ' ')} · {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {p.payment_method ? ` · ${METHOD_LABELS[p.payment_method] ?? p.payment_method}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white font-semibold tabular-nums">${p.amount_paid.toFixed(2)}</p>
                        <p className={`text-xs ${
                          p.payment_status === 'paid'    ? 'text-emerald-400' :
                          p.payment_status === 'partial' ? 'text-yellow-400'  : 'text-red-400'
                        }`}>{p.payment_status}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Outstanding */}
          {outstanding.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <CardTitle className="text-yellow-400">Outstanding</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 p-0">
                {outstanding.map((o, i) => {
                  const dt = new Date(o.scheduled_datetime)
                  const owed = o.price != null
                    ? o.price - (o.amount_paid ?? 0)
                    : null
                  return (
                    <div
                      key={o.id}
                      className={`flex items-center gap-3 px-6 py-3 ${i !== outstanding.length - 1 ? 'border-b border-slate-800' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-yellow-100 text-sm font-medium truncate">
                          {o.client ? `${o.client.first_name} ${o.client.last_name}` : 'Unknown'}
                          {o.pet ? <span className="text-yellow-300/60 font-normal"> · {o.pet.name}</span> : null}
                        </p>
                        <p className="text-yellow-500/70 text-xs mt-0.5">
                          {o.service_type.replace('_', ' ')} · {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {owed != null ? (
                          <p className="text-yellow-400 font-semibold tabular-nums">${owed.toFixed(2)}</p>
                        ) : null}
                        <p className="text-yellow-500 text-xs capitalize">{o.payment_status}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-500" />
            <p className="text-slate-500 text-xs">Showing payments from completed appointments in {monthLabel}.</p>
          </div>
        </>
      )}
    </div>
  )
}
