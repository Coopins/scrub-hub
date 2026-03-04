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
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const SERVICE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  bath: { bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-500' },
  groom: { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  deluxe: { bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-300', dot: 'bg-orange-500' },
  nail_trim: { bg: 'bg-purple-500/20 border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-500' },
  other: { bg: 'bg-slate-500/20 border-slate-500/40', text: 'text-slate-300', dot: 'bg-slate-500' },
}

const CANCELLED_COLORS = { bg: 'bg-slate-700/30 border-slate-600/30', text: 'text-slate-600' }
const COMPLETED_COLORS = { bg: 'bg-slate-600/20 border-slate-500/30', text: 'text-slate-500' }

function toDatetimeLocal(iso: string): string {
  const dt = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
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

export default function CalendarPage() {
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

  const supabase = createClient()

  const [form, setForm] = useState(BLANK_FORM)

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0)

    const [apptRes, clientRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, client:clients(*), pet:pets(*)')
        .eq('groomer_id', user.id)
        .gte('scheduled_datetime', startOfMonth.toISOString())
        .lte('scheduled_datetime', endOfMonth.toISOString()),
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
    fetchPetsForClient(clientId)
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
    setForm({ ...BLANK_FORM, scheduled_datetime: prefillDate ?? '' })
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
      scheduled_datetime: form.scheduled_datetime,
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

  // Calendar helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  function getApptsForDay(day: number) {
    return appointments.filter(a => {
      const d = new Date(a.scheduled_datetime)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const isToday = (day: number) => {
    const t = new Date()
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day
  }

  const isCurrentMonth = () => {
    const t = new Date()
    return t.getFullYear() === year && t.getMonth() === month
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-slate-400">Manage your appointments</p>
        </div>
        <Button
          onClick={() => openAddDialog()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
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

      {/* Calendar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <CardTitle className="text-white">{monthName}</CardTitle>
            {!isCurrentMonth() && (
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
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-slate-500 text-xs font-medium py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-lg overflow-hidden">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-900 min-h-[80px] p-1" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayAppts = getApptsForDay(day)
              const pad = (n: number) => String(n).padStart(2, '0')
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}T09:00`

              return (
                <div
                  key={day}
                  onClick={() => openAddDialog(dateStr)}
                  className="bg-slate-900 min-h-[80px] p-1 hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <div className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                    isToday(day) ? "bg-emerald-600 text-white" : "text-slate-400"
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map(appt => {
                      const isCompleted = appt.status === 'completed'
                      const isCancelled = appt.status === 'cancelled'
                      const colors = isCancelled
                        ? CANCELLED_COLORS
                        : isCompleted
                        ? COMPLETED_COLORS
                        : SERVICE_COLORS[appt.service_type] ?? SERVICE_COLORS.other

                      return (
                        <div
                          key={appt.id}
                          title={appt.notes ?? undefined}
                          onClick={e => { e.stopPropagation(); setSelectedAppointment(appt) }}
                          className={cn(
                            'text-xs px-1 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity',
                            colors.bg,
                            colors.text,
                            isCancelled && 'line-through'
                          )}
                        >
                          {isCompleted && '✓ '}
                          {new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} {appt.pet?.name}
                        </div>
                      )
                    })}
                    {dayAppts.length > 3 && (
                      <div className="text-xs text-slate-500 pl-1">+{dayAppts.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Appointment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) handleCloseAddDialog() }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingAppointmentId ? 'Edit Appointment' : 'New Appointment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Client *</Label>
              <Select value={form.client_id} onValueChange={handleClientChange}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
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
                  <div className="text-sm text-slate-400 bg-slate-800 border border-slate-600 rounded-md px-3 py-2">
                    No pets found —{' '}
                    <Link href={`/clients/${form.client_id}`} target="_blank" className="text-emerald-400 hover:underline">
                      add a pet to this client first
                    </Link>
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
            {form.client_id && clientPets.length === 0 && (
              <p className="text-xs text-slate-500 text-center">Add a pet to this client to continue</p>
            )}
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
                    <p className="text-sm text-white">{appt.pet?.name} <span className="text-slate-400">({appt.pet?.breed ?? appt.pet?.species})</span></p>
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
                    <p className="text-sm text-white">{dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="text-xs text-slate-400">{dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
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
    </div>
  )
}
