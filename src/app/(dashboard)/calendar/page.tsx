'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Appointment, Client, Pet } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'


// Service colors are stored in a single map so they can be replaced with values
// fetched from groomer_profiles (e.g. a `service_colors` JSONB column) to support
// user customization in a future update — no other code changes would be required.
const SERVICE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  bath:      { bg: 'bg-blue-500/20 border-blue-500/40',      text: 'text-blue-300',    dot: 'bg-blue-500'    },
  groom:     { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  deluxe:    { bg: 'bg-orange-500/20 border-orange-500/40',   text: 'text-orange-300',  dot: 'bg-orange-500'  },
  nail_trim: { bg: 'bg-purple-500/20 border-purple-500/40',   text: 'text-purple-300',  dot: 'bg-purple-500'  },
  other:     { bg: 'bg-slate-500/20 border-slate-500/40',     text: 'text-slate-300',   dot: 'bg-slate-500'   },
}

const CANCELLED_COLORS = { bg: 'bg-slate-700/30 border-slate-600/30', text: 'text-slate-600' }
const COMPLETED_COLORS  = { bg: 'bg-slate-600/20 border-slate-500/30', text: 'text-slate-500' }

type CalendarView = 'month' | 'week' | 'day'

// Convert a UTC ISO string to the value format expected by <input type="datetime-local">
function toDatetimeLocal(iso: string): string {
  const dt = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function getWeekDays(date: Date): Date[] {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

const BLANK_FORM = {
  client_id: '',
  pet_id: '',
  service_type: 'groom',
  scheduled_datetime: '',
  duration_minutes: 90,
  price: '',
  notes: '',
}

const BLANK_NEW_CLIENT = { first_name: '', last_name: '', phone: '', email: '' }
const BLANK_NEW_PET = { name: '', species: 'dog', breed: '' }

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientPets, setClientPets] = useState<Pet[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSmartPopup, setShowSmartPopup] = useState(false)
  const [popupWarnings, setPopupWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showCompletePrompt, setShowCompletePrompt] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')
  const [completing, setCompleting] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientForm, setNewClientForm] = useState(BLANK_NEW_CLIENT)
  const [savingClient, setSavingClient] = useState(false)
  const [showNewPetForm, setShowNewPetForm] = useState(false)
  const [newPetForm, setNewPetForm] = useState(BLANK_NEW_PET)
  const [savingPet, setSavingPet] = useState(false)

  const supabase = createClient()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch prev month through next month so all views (including edge-of-month weeks) are covered
    const startRange = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const endRange   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0)

    const [apptRes, clientRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, client:clients(*), pet:pets(*)')
        .eq('groomer_id', user.id)
        .gte('scheduled_datetime', startRange.toISOString())
        .lte('scheduled_datetime', endRange.toISOString()),
      supabase
        .from('clients')
        .select('*')
        .eq('groomer_id', user.id)
        .order('last_name'),
    ])

    setAppointments(apptRes.data ?? [])
    setClients(clientRes.data ?? [])
  }

  useEffect(() => { fetchData() }, [currentDate])

  async function fetchPetsForClient(clientId: string) {
    const { data } = await supabase.from('pets').select('*').eq('client_id', clientId)
    setClientPets(data ?? [])
  }

  function checkWarnings(clientId: string): string[] {
    const client = clients.find(c => c.id === clientId)
    if (!client) return []
    const warnings: string[] = []
    if (client.status === 'do_not_book') warnings.push('⛔ DO NOT BOOK — Check notes before scheduling')
    if (client.deposit_required) warnings.push('💰 DEPOSIT REQUIRED before confirming appointment')
    if (client.no_text_messages) warnings.push('📵 NO TEXT MESSAGES — Must call to confirm')
    return warnings
  }

  function handleClientChange(clientId: string) {
    setForm({ ...form, client_id: clientId, pet_id: '' })
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
    fetchPetsForClient(clientId)
  }

  async function handleSaveNewPet() {
    if (!newPetForm.name || !form.client_id) return
    setSavingPet(true)
    const { data: newPet, error } = await supabase.from('pets').insert({
      client_id: form.client_id,
      name: newPetForm.name,
      species: newPetForm.species,
      breed: newPetForm.breed || null,
    }).select().single()
    if (error) { toast.error(error.message); setSavingPet(false); return }
    toast.success(`${newPetForm.name} added!`)
    setClientPets(prev => [...prev, newPet])
    setForm(f => ({ ...f, pet_id: newPet.id }))
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
    setSavingPet(false)
  }

  function handleBookClick() {
    if (!form.client_id) return
    const warnings = checkWarnings(form.client_id)
    if (warnings.length > 0) {
      setPopupWarnings(warnings)
      setShowSmartPopup(true)
    } else {
      handleSave()
    }
  }

  function openAddDialog(prefillDate?: string) {
    let dateToUse = prefillDate ?? ''
    // In day view, pre-fill the current day at 9 AM
    if (!prefillDate && view === 'day') {
      const d = currentDate
      const pad = (n: number) => String(n).padStart(2, '0')
      dateToUse = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`
    }
    setForm({ ...BLANK_FORM, scheduled_datetime: dateToUse })
    setClientPets([])
    setEditingAppointmentId(null)
    setShowAddDialog(true)
  }

  function handleOpenEdit(appt: Appointment) {
    setForm({
      client_id: appt.client_id,
      pet_id: appt.pet_id,
      service_type: appt.service_type,
      scheduled_datetime: toDatetimeLocal(appt.scheduled_datetime),
      duration_minutes: appt.duration_minutes,
      price: appt.price != null ? String(appt.price) : '',
      notes: appt.notes ?? '',
    })
    fetchPetsForClient(appt.client_id)
    setEditingAppointmentId(appt.id)
    setSelectedAppointment(null)
    setShowAddDialog(true)
  }

  function handleCloseAddDialog() {
    setShowAddDialog(false)
    setEditingAppointmentId(null)
    setForm(BLANK_FORM)
    setClientPets([])
    setShowNewClientForm(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
  }

  async function handleSaveNewClient() {
    if (!newClientForm.first_name || !newClientForm.last_name || !newClientForm.phone) return
    setSavingClient(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingClient(false); return }

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        groomer_id: user.id,
        first_name: newClientForm.first_name,
        last_name: newClientForm.last_name,
        phone: newClientForm.phone,
        email: newClientForm.email || null,
        status: 'active',
        no_text_messages: false,
        deposit_required: false,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create client')
      setSavingClient(false)
      return
    }

    // Add to the local list (sorted), auto-select, collapse the mini-form
    setClients(prev => [...prev, newClient].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    handleClientChange(newClient.id)
    setShowNewClientForm(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    toast.success(`${newClient.first_name} ${newClient.last_name} added!`)
    setSavingClient(false)
  }

  async function handleSave() {
    setSaving(true)
    setShowSmartPopup(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      client_id: form.client_id,
      pet_id: form.pet_id,
      service_type: form.service_type,
      // Convert the local datetime-local string to UTC ISO before storing.
      // Without this, the browser-local time gets interpreted as UTC in PostgreSQL,
      // causing the appointment to appear shifted by the user's UTC offset.
      scheduled_datetime: new Date(form.scheduled_datetime).toISOString(),
      duration_minutes: form.duration_minutes,
      price: form.price ? parseFloat(form.price) : null,
      notes: form.notes,
    }

    let error
    if (editingAppointmentId) {
      ;({ error } = await supabase.from('appointments').update(payload).eq('id', editingAppointmentId))
    } else {
      ;({ error } = await supabase.from('appointments').insert({ ...payload, groomer_id: user.id }))
    }

    if (error) {
      toast.error(editingAppointmentId ? 'Failed to update appointment' : 'Failed to save appointment')
      setSaving(false)
      return
    }

    toast.success(editingAppointmentId ? 'Appointment updated!' : 'Appointment scheduled!')
    handleCloseAddDialog()
    fetchData()
    setSaving(false)
  }

  async function handleCancelAppointment(appointmentId: string) {
    setCancelling(true)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)

    if (error) {
      toast.error('Failed to cancel appointment')
      setCancelling(false)
      return
    }

    toast.success('Appointment cancelled')
    setSelectedAppointment(null)
    fetchData()
    setCancelling(false)
  }

  async function handleMarkComplete() {
    if (!selectedAppointment) return
    setCompleting(true)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed', service_notes: completeNotes || null })
      .eq('id', selectedAppointment.id)

    if (error) {
      toast.error('Failed to mark as complete')
      setCompleting(false)
      return
    }

    toast.success('Appointment marked complete!')
    setShowCompletePrompt(false)
    setCompleteNotes('')
    setSelectedAppointment(null)
    fetchData()
    setCompleting(false)
  }

  // ---- Navigation ----
  function navigatePrev() {
    if (view === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else if (view === 'week') {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
    }
  }

  function navigateNext() {
    if (view === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else if (view === 'week') {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
    }
  }

  function isViewingToday(): boolean {
    const today = new Date()
    if (view === 'month') return today.getFullYear() === year && today.getMonth() === month
    if (view === 'day')   return isSameDay(currentDate, today)
    return getWeekDays(currentDate).some(d => isSameDay(d, today))
  }

  function getPeriodLabel(): string {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    const days = getWeekDays(currentDate)
    const start = days[0], end = days[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
    }
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  // ---- Calendar helpers ----
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weekDays    = getWeekDays(currentDate)

  function getApptsForDay(day: number): Appointment[] {
    return appointments.filter(a => {
      const d = new Date(a.scheduled_datetime)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function getApptsForDate(date: Date): Appointment[] {
    return appointments
      .filter(a => isSameDay(new Date(a.scheduled_datetime), date))
      .sort((a, b) => new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime())
  }

  function isToday(day: number): boolean {
    const t = new Date()
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
  }

  function getApptDotColor(appt: Appointment): string {
    if (appt.status === 'cancelled') return 'bg-slate-700'
    if (appt.status === 'completed') return 'bg-slate-500'
    return SERVICE_COLORS[appt.service_type]?.dot ?? SERVICE_COLORS.other.dot
  }

  // In month view, clicking a day navigates to day view instead of opening the New Appointment dialog
  function handleMonthDayClick(day: number) {
    setCurrentDate(new Date(year, month, day))
    setView('day')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-slate-400">Manage your appointments</p>
        </div>
        {/* Desktop: button in header. Mobile: replaced by FAB below */}
        <Button
          onClick={() => openAddDialog()}
          className="hidden md:flex bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule Appointment
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(SERVICE_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <span className="text-slate-400 text-xs capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs">✓ completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-600 text-xs line-through">cancelled</span>
        </div>
      </div>

      {/* Calendar card */}
      <Card className="bg-slate-900 border-slate-800">
        {/* Nav header */}
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={navigatePrev}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <CardTitle className="text-white text-sm sm:text-base">{getPeriodLabel()}</CardTitle>
            {!isViewingToday() && (
              <Button
                variant="ghost"
                onClick={() => setCurrentDate(new Date())}
                className="text-xs text-slate-400 hover:text-white border border-slate-700 px-2 h-7 rounded"
              >
                Today
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={navigateNext}
            className="text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>

        {/* View switcher */}
        <div className="px-6 pb-4 flex gap-1 border-b border-slate-800">
          {(['month', 'week', 'day'] as CalendarView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors capitalize',
                view === v
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <CardContent className="pt-4">

          {/* ---- MONTH VIEW: colored dots per appointment ---- */}
          {view === 'month' && (
            <>
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-slate-500 text-xs font-medium py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-lg overflow-hidden">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-slate-900 min-h-[72px] md:min-h-[80px] p-1" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dayAppts = getApptsForDay(day)
                  return (
                    <div
                      key={day}
                      onClick={() => handleMonthDayClick(day)}
                      className="bg-slate-900 min-h-[72px] md:min-h-[80px] p-1 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <div className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                        isToday(day) ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      )}>
                        {day}
                      </div>
                      {/* One dot per appointment, colored by service type */}
                      {/* stopPropagation on container prevents any click in dot area from navigating to day view */}
                      <div className="flex flex-wrap gap-0.5" onClick={e => e.stopPropagation()}>
                        {dayAppts.slice(0, 14).map(appt => (
                          <div
                            key={appt.id}
                            onClick={e => { e.stopPropagation(); setSelectedAppointment(appt) }}
                            title={`${new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${appt.pet?.name} · ${appt.service_type.replace('_', ' ')}`}
                            className="p-1 -m-1 cursor-pointer flex-shrink-0"
                          >
                            <div className={cn(
                              'w-2 h-2 rounded-full hover:scale-125 transition-transform',
                              getApptDotColor(appt)
                            )} />
                          </div>
                        ))}
                        {dayAppts.length > 14 && (
                          <span className="text-slate-500 text-xs leading-none self-center">+{dayAppts.length - 14}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ---- WEEK VIEW: compact time + name ---- */}
          {view === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Day headers — click to navigate to day view */}
                <div className="grid grid-cols-7 gap-px mb-px">
                  {weekDays.map((day, idx) => {
                    const todayFlag = isSameDay(day, new Date())
                    return (
                      <div
                        key={idx}
                        onClick={() => { setCurrentDate(day); setView('day') }}
                        className={cn(
                          'p-2 text-center cursor-pointer hover:bg-slate-800/50 transition-colors rounded-t',
                          todayFlag && 'bg-emerald-600/10'
                        )}
                      >
                        <div className="text-xs text-slate-500">
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={cn(
                          'text-sm font-medium w-7 h-7 mx-auto flex items-center justify-center rounded-full',
                          todayFlag ? 'bg-emerald-600 text-white' : 'text-white'
                        )}>
                          {day.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Appointment columns */}
                <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-lg overflow-hidden">
                  {weekDays.map((day, idx) => {
                    const dayAppts = getApptsForDate(day)
                    return (
                      <div key={idx} className="bg-slate-900 min-h-[200px] p-1.5 space-y-1">
                        {dayAppts.map(appt => (
                          <div
                            key={appt.id}
                            onClick={() => setSelectedAppointment(appt)}
                            className="flex items-start gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-slate-800 transition-colors"
                          >
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', getApptDotColor(appt))} />
                            <div className="min-w-0">
                              <div className={cn(
                                'text-xs font-medium leading-tight',
                                appt.status === 'cancelled' ? 'text-slate-600 line-through' : 'text-slate-300'
                              )}>
                                {new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </div>
                              <div className={cn(
                                'text-xs truncate leading-tight',
                                appt.status === 'cancelled' ? 'text-slate-600' : 'text-slate-400'
                              )}>
                                {appt.pet?.name}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ---- DAY VIEW: full appointment details ---- */}
          {view === 'day' && (() => {
            const dayAppts = getApptsForDate(currentDate)
            if (dayAppts.length === 0) {
              return (
                <div className="text-center py-12 text-slate-500">
                  <p>No appointments for this day</p>
                  <Button
                    onClick={() => openAddDialog()}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              )
            }
            return (
              <div className="space-y-4">
                {dayAppts.map(appt => {
                  const isCompleted = appt.status === 'completed'
                  const isCancelled = appt.status === 'cancelled'
                  const colors = isCancelled
                    ? CANCELLED_COLORS
                    : isCompleted
                    ? COMPLETED_COLORS
                    : SERVICE_COLORS[appt.service_type] ?? SERVICE_COLORS.other
                  const dt = new Date(appt.scheduled_datetime)
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setSelectedAppointment(appt)}
                      className={cn('p-5 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity', colors.bg)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-sm font-semibold tabular-nums', colors.text)}>
                              {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="text-white font-medium">{appt.pet?.name}</span>
                            {appt.pet?.breed && <span className="text-slate-500 text-xs">{appt.pet.breed}</span>}
                            {isCompleted && <span className="text-emerald-400 text-xs">✓ completed</span>}
                            {isCancelled && <span className="text-slate-500 text-xs line-through">cancelled</span>}
                          </div>
                          <p className="text-slate-400 text-sm mt-0.5">
                            {appt.client?.first_name} {appt.client?.last_name}
                          </p>
                          <p className={cn('text-xs mt-1 capitalize', colors.text)}>
                            {appt.service_type.replace('_', ' ')} · {appt.duration_minutes} min
                            {appt.price != null ? ` · $${appt.price.toFixed(2)}` : ''}
                          </p>
                          {appt.notes && (
                            <p className="text-slate-400 text-xs mt-1 italic">"{appt.notes}"</p>
                          )}
                          {appt.service_notes && (
                            <p className="text-slate-300 text-xs mt-1">Grooming notes: {appt.service_notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Add / Edit Appointment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) handleCloseAddDialog() }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingAppointmentId ? 'Edit Appointment' : 'Schedule Appointment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Client *</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={form.client_id} onValueChange={handleClientChange}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-full">
                      <SelectValue placeholder="Select client..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!editingAppointmentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClientForm(v => !v)
                      setNewClientForm(BLANK_NEW_CLIENT)
                    }}
                    className={cn(
                      'flex items-center gap-1 text-xs px-3 py-2 rounded-md border whitespace-nowrap transition-colors flex-shrink-0',
                      showNewClientForm
                        ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                        : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                    )}
                  >
                    {showNewClientForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Add Client</>}
                  </button>
                )}
              </div>
            </div>

            {/* Inline new client mini-form */}
            {showNewClientForm && !editingAppointmentId && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                <p className="text-xs font-medium text-slate-400">New Client</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">First Name *</Label>
                    <Input
                      value={newClientForm.first_name}
                      onChange={e => setNewClientForm({ ...newClientForm, first_name: e.target.value })}
                      placeholder="First"
                      className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Last Name *</Label>
                    <Input
                      value={newClientForm.last_name}
                      onChange={e => setNewClientForm({ ...newClientForm, last_name: e.target.value })}
                      placeholder="Last"
                      className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Phone *</Label>
                  <Input
                    type="tel"
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                    className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Email</Label>
                  <Input
                    type="email"
                    value={newClientForm.email}
                    onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    placeholder="Optional"
                    className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => { setShowNewClientForm(false); setNewClientForm(BLANK_NEW_CLIENT) }}
                    className="flex-1 h-8 text-sm bg-red-600 hover:bg-red-700 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveNewClient}
                    disabled={savingClient || !newClientForm.first_name || !newClientForm.last_name || !newClientForm.phone}
                    className="flex-1 h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {savingClient ? 'Saving...' : 'Save Client'}
                  </Button>
                </div>
              </div>
            )}

            {form.client_id && (
              <div className="space-y-1">
                <Label className="text-slate-300">Pet *</Label>
                {clientPets.length > 0 ? (
                  <Select value={form.pet_id} onValueChange={v => setForm({ ...form, pet_id: v })}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Select pet..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {clientPets.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.breed ?? p.species})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <div className="text-sm text-slate-400 bg-slate-800 border border-slate-600 rounded-md px-3 py-2 flex items-center justify-between">
                      <span>No pets found</span>
                      <button
                        type="button"
                        onClick={() => setShowNewPetForm(v => !v)}
                        className={cn(
                          'flex items-center gap-1 text-xs px-2 py-1 rounded border whitespace-nowrap transition-colors',
                          showNewPetForm
                            ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                            : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                        )}
                      >
                        {showNewPetForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Add Pet</>}
                      </button>
                    </div>
                    {showNewPetForm && (
                      <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                        <p className="text-xs font-medium text-slate-400">New Pet</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-slate-400 text-xs">Name *</Label>
                            <Input
                              value={newPetForm.name}
                              onChange={e => setNewPetForm({ ...newPetForm, name: e.target.value })}
                              placeholder="Buddy"
                              className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-400 text-xs">Species</Label>
                            <Select value={newPetForm.species} onValueChange={v => setNewPetForm({ ...newPetForm, species: v })}>
                              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-600">
                                <SelectItem value="dog">🐕 Dog</SelectItem>
                                <SelectItem value="cat">🐈 Cat</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-400 text-xs">Breed</Label>
                          <Input
                            value={newPetForm.breed}
                            onChange={e => setNewPetForm({ ...newPetForm, breed: e.target.value })}
                            placeholder="Golden Retriever"
                            className="bg-slate-800 border-slate-600 text-white h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            onClick={() => { setShowNewPetForm(false); setNewPetForm(BLANK_NEW_PET) }}
                            className="flex-1 h-8 text-sm bg-red-600 hover:bg-red-700 text-white"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleSaveNewPet}
                            disabled={savingPet || !newPetForm.name}
                            className="flex-1 h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {savingPet ? 'Saving...' : 'Save Pet'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-slate-300">Service *</Label>
              <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="bath">🔵 Bath</SelectItem>
                  <SelectItem value="groom">🟢 Groom</SelectItem>
                  <SelectItem value="deluxe">🟠 Deluxe</SelectItem>
                  <SelectItem value="nail_trim">🟣 Nail Trim</SelectItem>
                  <SelectItem value="other">⚪ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-300">Date & Time *</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_datetime}
                onChange={e => setForm({ ...form, scheduled_datetime: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Duration (min)</Label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Price ($)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCloseAddDialog}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBookClick}
                disabled={saving || !form.client_id || !form.pet_id || !form.scheduled_datetime}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? 'Saving...' : editingAppointmentId ? 'Update Appointment' : 'Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Popup Warning Dialog */}
      <Dialog open={showSmartPopup} onOpenChange={setShowSmartPopup}>
        <DialogContent className="bg-slate-900 border-yellow-500/50 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Heads Up Before Scheduling
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {popupWarnings.map((w, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200">
                {w}
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowSmartPopup(false)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={open => { if (!open) setSelectedAppointment(null) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (() => {
            const appt = selectedAppointment
            const isCompleted = appt.status === 'completed'
            const isCancelled = appt.status === 'cancelled'
            const colors = isCancelled
              ? CANCELLED_COLORS
              : isCompleted
              ? COMPLETED_COLORS
              : SERVICE_COLORS[appt.service_type] ?? SERVICE_COLORS.other
            const dt = new Date(appt.scheduled_datetime)
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Client</p>
                    <p className="text-sm text-white">{appt.client?.first_name} {appt.client?.last_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Pet</p>
                    <p className="text-sm text-white">
                      {appt.pet?.name} <span className="text-slate-400">({appt.pet?.breed ?? appt.pet?.species})</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Service</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${colors.bg} ${colors.text}`}>
                      {appt.service_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Duration</p>
                    <p className="text-sm text-white">{appt.duration_minutes} min</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Date & Time</p>
                    <p className="text-sm text-white">
                      {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Price</p>
                    <p className="text-sm text-white">{appt.price != null ? `$${appt.price.toFixed(2)}` : '—'}</p>
                  </div>
                </div>
                {appt.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-slate-300 bg-slate-800 rounded-md px-3 py-2">{appt.notes}</p>
                  </div>
                )}
                {!isCompleted && !isCancelled && (
                  <Button
                    onClick={() => setShowCompletePrompt(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleOpenEdit(appt)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleCancelAppointment(appt.id)}
                    disabled={cancelling || isCancelled}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Appointment'}
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Mark Complete — Grooming Notes Prompt */}
      <Dialog open={showCompletePrompt} onOpenChange={open => { if (!open) { setShowCompletePrompt(false); setCompleteNotes('') } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Complete Appointment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Add grooming notes before completing</Label>
              <Textarea
                value={completeNotes}
                onChange={e => setCompleteNotes(e.target.value)}
                placeholder="e.g. Coat condition, behavior, next recommended service..."
                className="bg-slate-800 border-slate-600 text-white resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => { setShowCompletePrompt(false); setCompleteNotes('') }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkComplete}
                disabled={completing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {completing ? 'Saving...' : 'Mark Complete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile FAB — fixed above bottom nav, hidden on md+ */}
      <button
        onClick={() => openAddDialog()}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-lg flex items-center justify-center transition-colors"
        aria-label="Schedule Appointment"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  )
}
