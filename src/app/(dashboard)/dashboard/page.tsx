import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, DollarSign, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import TodayScheduleSection from '@/components/TodayScheduleSection'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const { data: todayAppts } = await supabase
    .from('appointments')
    .select('*, client:clients(*), pet:pets(*)')
    .eq('groomer_id', user.id)
    .gte('scheduled_datetime', today.toISOString())
    .lt('scheduled_datetime', tomorrow.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_datetime')

  const { count: upcomingCount } = await supabase
    .from('appointments').select('*', { count: 'exact', head: true })
    .eq('groomer_id', user.id)
    .gte('scheduled_datetime', today.toISOString())
    .lt('scheduled_datetime', nextWeek.toISOString())
    .neq('status', 'cancelled')

  const { data: upcomingAppts } = await supabase
    .from('appointments')
    .select('*, client:clients(*), pet:pets(*)')
    .eq('groomer_id', user.id)
    .gte('scheduled_datetime', tomorrow.toISOString())
    .lt('scheduled_datetime', nextWeek.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_datetime')
    .limit(3)

  const todayRevenue = (todayAppts ?? [])
    .filter(a => a.payment_status === 'paid' || a.payment_status === 'partial')
    .reduce((sum, a) => sum + (a.amount_paid ?? 0), 0)
  const revenueDisplay = todayRevenue % 1 === 0
    ? `$${todayRevenue}`
    : `$${todayRevenue.toFixed(2)}`

  const { data: profile } = await supabase
    .from('groomer_profiles').select('*').eq('id', user.id).single()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const firstName = (profile as any)?.first_name ?? profile?.business_name ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Good {greeting}, {firstName}</h1>
        <p className="text-slate-400">
          {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/calendar" className="block">
          <Card className="bg-slate-800 border-slate-700 border-l-4 border-l-green-500 hover:border-l-green-400 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-300 text-sm font-medium">Today</CardTitle>
              <Calendar className="w-4 h-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{todayAppts?.length ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar" className="block">
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-400 text-sm font-medium">This Week</CardTitle>
              <CheckCircle className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{upcomingCount ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">this week</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/revenue" className="block">
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-400 text-sm font-medium">Today&apos;s Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{revenueDisplay}</p>
              <p className="text-xs text-slate-500 mt-1">collected today</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <TodayScheduleSection initialAppts={todayAppts ?? []} upcomingAppts={upcomingAppts ?? []} />
    </div>
  )
}
