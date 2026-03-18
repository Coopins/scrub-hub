'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Download, TrendingUp, CreditCard } from 'lucide-react'

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
  const [loading, setLoading]   = useState(true)
  const now = new Date()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('appointments')
        .select('id, service_type, scheduled_datetime, amount_paid, payment_method, payment_status, paid_at, client:clients(first_name, last_name), pet:pets(name)')
        .eq('groomer_id', user.id)
        .eq('status', 'completed')
        .not('amount_paid', 'is', null)
        .gte('scheduled_datetime', startOfMonth(now).toISOString())
        .lte('scheduled_datetime', endOfMonth(now).toISOString())
        .order('scheduled_datetime', { ascending: false })

      setPayments((data ?? []) as unknown as PaymentRow[])
      setLoading(false)
    }
    load()
  }, [])

  function sumPayments(filter: (p: PaymentRow) => boolean): number {
    return payments.filter(filter).reduce((acc, p) => acc + (p.amount_paid ?? 0), 0)
  }

  const todayTotal = sumPayments(p => new Date(p.scheduled_datetime) >= startOfDay(now))
  const weekTotal  = sumPayments(p => new Date(p.scheduled_datetime) >= startOfWeek(now))
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
    a.download = `scrub-hub-revenue-${now.toISOString().slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue</h1>
          <p className="text-slate-400">{monthLabel}</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today',      value: todayTotal },
          { label: 'This Week',  value: weekTotal  },
          { label: 'This Month', value: monthTotal  },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="pt-5 pb-4">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
              <p className="text-white text-xl font-bold mt-1 tabular-nums">
                ${value.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading…</div>
      ) : payments.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No payments recorded this month.
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

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-500" />
            <p className="text-slate-500 text-xs">Showing payments from completed appointments in {monthLabel}.</p>
          </div>
        </>
      )}
    </div>
  )
}
