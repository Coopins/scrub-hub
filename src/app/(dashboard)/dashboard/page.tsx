import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, CheckCircle } from 'lucide-react'

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

  const serviceColors: Record<string, string> = {
    bath: 'bg-blue-500', groom: 'bg-emerald-500',
    deluxe: 'bg-orange-500', nail_trim: 'bg-purple-500', other: 'bg-slate-500',
  }

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Today</CardTitle>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{todayAppts?.length ?? 0}</p></CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">This Week</CardTitle>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{upcomingCount ?? 0}</p></CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Total Clients</CardTitle>
            <Users className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{clientCount ?? 0}</p></CardContent>
        </Card>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white">Today's Schedule</CardTitle></CardHeader>
        <CardContent>
          {!todayAppts || todayAppts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No appointments today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppts.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${serviceColors[appt.service_type] ?? 'bg-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{appt.pet?.name} — {appt.client?.first_name} {appt.client?.last_name}</p>
                    <p className="text-slate-400 text-sm capitalize">{appt.service_type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm">{new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                    {appt.price && <p className="text-emerald-400 text-sm">\${appt.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
