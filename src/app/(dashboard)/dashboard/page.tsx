import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, CheckCircle } from 'lucide-react'
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

  const { count: clientCount } = await supabase
    .from('clients').select('*', { count: 'exact', head: true }).eq('groomer_id', user.id)

  const { count: upcomingCount } = await supabase
    .from('appointments').select('*', { count: 'exact', head: true })
    .eq('groomer_id', user.id)
    .gte('scheduled_datetime', today.toISOString())
    .lt('scheduled_datetime', nextWeek.toISOString())
    .neq('status', 'cancelled')

  const { data: profile } = await supabase
    .from('groomer_profiles').select('*').eq('id', user.id).single()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Good {greeting} 👋</h1>
        <p className="text-slate-400">
          {profile?.business_name} — {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats cards — each links to its relevant section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/calendar" className="block">
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-400 text-sm font-medium">Today</CardTitle>
              <Calendar className="w-4 h-4 text-emerald-500" />
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
              <p className="text-xs text-slate-500 mt-1">upcoming</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clients" className="block">
          <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-slate-400 text-sm font-medium">Total Clients</CardTitle>
              <Users className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{clientCount ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">in your roster</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <TodayScheduleSection initialAppts={todayAppts ?? []} />
    </div>
  )
}
