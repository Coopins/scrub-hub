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
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, X, Bell, DollarSign } from 'lucide-react'
import { scheduleReminders } from '@/lib/scheduleReminders'
import { type Notification } from '@/lib/types'
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

function PaymentBadge({ status }: { status?: string }) {
  if (status === 'paid')    return <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Paid</span>
  if (status === 'partial') return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Partial</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Unpaid</span>
}

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
  is_recurring: false,
  recurring_frequency: 'every4weeks',
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  every3weeks: 'Every 3 weeks',
  every4weeks: 'Every 4 weeks',
  every6weeks: 'Every 6 weeks',
  every8weeks: 'Every 8 weeks',
}

function getFrequencyDays(freq: string): number {
  const map: Record<string, number> = {
    weekly: 7, biweekly: 14, every3weeks: 21,
    every4weeks: 28, every6weeks: 42, every8weeks: 56,
  }
  return map[freq] ?? 28
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
  const [popupWarnings, setPopupWarnings] = useState<{ text: string; className: string }[]>([])
  const [isDNBClient, setIsDNBClient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showCompletePrompt, setShowCompletePrompt] = useState(false)
  const [completeNotes, setCompleteNotes] = useState('')
  const [form, setForm] = useState(BLANK_FORM)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientForm, setNewClientForm] = useState(BLANK_NEW_CLIENT)
  const [savingClient, setSavingClient] = useState(false)
  const [showNewPetForm, setShowNewPetForm] = useState(false)
  const [newPetForm, setNewPetForm] = useState(BLANK_NEW_PET)
  const [savingPet, setSavingPet] = useState(false)
  const [selectedApptNotifications, setSelectedApptNotifications] = useState<Notification[]>([])
  const [showPaymentPrompt, setShowPaymentPrompt]   = useState(false)
  const [paymentAmount, setPaymentAmount]           = useState('')
  const [paymentMethod, setPaymentMethod]           = useState('cash')
  const [depositAmount, setDepositAmount]           = useState('')
  const [paymentNote, setPaymentNote]               = useState('')
  const [savingPayment, setSavingPayment]           = useState(false)

  // Schedule-next prompt (shown after checkout)
  const [showScheduleNext, setShowScheduleNext] = useState(false)
  const [nextSeriesAppt, setNextSeriesAppt] = useState<Appointment | null>(null)
  const [scheduleNextIsRecurring, setScheduleNextIsRecurring] = useState(false)
  const [scheduleNextDate, setScheduleNextDate] = useState('')
  const [completedApptRef, setCompletedApptRef] = useState<{ client_id: string; pet_id: string; service_type: string; duration_minutes: number; price: string } | null>(null)
  const [savingScheduleNext, setSavingScheduleNext] = useState(false)

  // Edit-series dialog
  const [showEditSeries, setShowEditSeries] = useState(false)
  const [editSeriesForm, setEditSeriesForm] = useState({ service_type: 'groom', duration_minutes: 90, price: '', notes: '' })
  const [savingSeriesEdit, setSavingSeriesEdit] = useState(false)

  // Day-click panel
  const [dayPanelDate, setDayPanelDate] = useState<Date | null>(null)

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

  function checkWarnings(clientId: string): { text: string; className: string }[] {
    const client = clients.find(c => c.id === clientId)
    if (!client) return []
    const warnings: { text: string; className: string }[] = []
    if (client.status === 'do_not_book') warnings.push({ text: '🚫 DO NOT BOOK — Check notes before scheduling', className: 'bg-red-950/40 border border-red-500/60 rounded-lg p-3 text-sm text-red-300' })
    if (client.unpaid_balance > 0) warnings.push({ text: `💰 UNPAID BALANCE — $${client.unpaid_balance.toFixed(2)} owed`, className: 'bg-red-950/40 border border-red-500/60 rounded-lg p-3 text-sm text-red-300' })
    if (client.deposit_required) warnings.push({ text: '⚠️ DEPOSIT REQUIRED before confirming appointment', className: 'bg-yellow-950/40 border border-yellow-500/60 rounded-lg p-3 text-sm text-yellow-300' })
    if (client.no_text_messages) warnings.push({ text: '📵 NO TEXT MESSAGES — Must call to confirm', className: 'bg-yellow-950/40 border border-yellow-500/60 rounded-lg p-3 text-sm text-yellow-300' })
    if (client.dog_aggressive) warnings.push({ text: '🐕 DOG AGGRESSIVE — Schedule at end of day', className: 'bg-orange-950/40 border border-orange-500/60 rounded-lg p-3 text-sm text-orange-300' })
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
      const client = clients.find(c => c.id === form.client_id)
      setIsDNBClient(client?.status === 'do_not_book')
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
      is_recurring: false,
      recurring_frequency: 'every4weeks',
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
    setShowNewClientModal(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
  }

  function handleCloseDetailDialog() {
    setSelectedAppointment(null)
    setSelectedApptNotifications([])
  }

  async function handleSelectAppointment(appt: Appointment) {
    setSelectedAppointment(appt)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('appointment_id', appt.id)
      .order('scheduled_for')
    setSelectedApptNotifications((data ?? []) as Notification[])
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

    // Add to the local list (sorted), auto-select, close the modal
    setClients(prev => [...prev, newClient].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    handleClientChange(newClient.id)
    setShowNewClientModal(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    toast.success(`${newClient.first_name} ${newClient.last_name} added!`)
    setSavingClient(false)
  }

  async function handleSave() {
    setSaving(true)
    setShowSmartPopup(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isNewRecurring = form.is_recurring && !editingAppointmentId
    const seriesId = isNewRecurring ? crypto.randomUUID() : undefined

    const payload = {
      client_id: form.client_id,
      pet_id: form.pet_id,
      service_type: form.service_type,
      scheduled_datetime: new Date(form.scheduled_datetime).toISOString(),
      duration_minutes: form.duration_minutes,
      price: form.price ? parseFloat(form.price) : null,
      notes: form.notes,
      ...(isNewRecurring && {
        is_recurring: true,
        recurring_frequency: form.recurring_frequency,
        recurring_series_id: seriesId,
      }),
    }

    let error
    let savedId: string | undefined
    if (editingAppointmentId) {
      ;({ error } = await supabase.from('appointments').update(payload).eq('id', editingAppointmentId))
      savedId = editingAppointmentId
    } else {
      const { data: newAppt, error: insertError } = await supabase
        .from('appointments')
        .insert({ ...payload, groomer_id: user.id })
        .select('id')
        .single()
      error = insertError
      savedId = newAppt?.id
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

    if (savedId) {
      scheduleReminders(savedId, user.id).catch(() => {})
      if (!editingAppointmentId) {
        fetch('/api/appointments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: savedId, groomerId: user.id }),
        }).catch(() => {})
      }
      // Generate recurring series non-blocking
      if (isNewRecurring && seriesId) {
        generateRecurringSeries(user.id, seriesId, form.recurring_frequency, {
          client_id: form.client_id,
          pet_id: form.pet_id,
          service_type: form.service_type,
          scheduled_datetime: new Date(form.scheduled_datetime).toISOString(),
          duration_minutes: form.duration_minutes,
          price: form.price ? parseFloat(form.price) : null,
          notes: form.notes,
        }).catch(() => {})
      }
    }
  }

  async function generateRecurringSeries(
    groomerId: string,
    seriesId: string,
    frequency: string,
    base: { client_id: string; pet_id: string; service_type: string; scheduled_datetime: string; duration_minutes: number; price: number | null; notes: string }
  ) {
    const freqDays = getFrequencyDays(frequency)
    const baseDate = new Date(base.scheduled_datetime)
    const cutoff = new Date(baseDate)
    cutoff.setFullYear(cutoff.getFullYear() + 1)

    const batch: object[] = []
    let next = new Date(baseDate)
    next.setDate(next.getDate() + freqDays)
    while (next <= cutoff) {
      batch.push({
        groomer_id: groomerId,
        client_id: base.client_id,
        pet_id: base.pet_id,
        service_type: base.service_type,
        scheduled_datetime: next.toISOString(),
        duration_minutes: base.duration_minutes,
        price: base.price,
        notes: base.notes,
        is_recurring: true,
        recurring_frequency: frequency,
        recurring_series_id: seriesId,
      })
      next = new Date(next)
      next.setDate(next.getDate() + freqDays)
    }
    if (batch.length > 0) {
      await supabase.from('appointments').insert(batch)
      toast.success(`🔄 Series created — ${batch.length + 1} appointments over 12 months`)
      fetchData()
    }
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
    handleCloseDetailDialog()
    fetchData()
    setCancelling(false)
  }

  function handleProceedToPayment() {
    setShowCompletePrompt(false)
    setPaymentAmount(selectedAppointment?.price != null ? String(selectedAppointment.price) : '')
    setPaymentMethod('cash')
    setDepositAmount('')
    setPaymentNote('')
    setShowPaymentPrompt(true)
  }

  async function handleSaveCompletion(skipPayment: boolean) {
    if (!selectedAppointment) return
    setSavingPayment(true)

    const amountPaid = !skipPayment && paymentAmount ? parseFloat(paymentAmount) : null
    const deposit    = !skipPayment && depositAmount  ? parseFloat(depositAmount)  : null
    const apptPrice  = selectedAppointment.price ?? 0
    const payStatus  = skipPayment || amountPaid === null ? 'unpaid'
      : amountPaid >= apptPrice ? 'paid'
      : amountPaid > 0          ? 'partial'
      : 'unpaid'

    const updateData: Record<string, unknown> = {
      status: 'completed',
      service_notes: completeNotes || null,
      payment_status: payStatus,
    }
    if (!skipPayment && amountPaid !== null) {
      updateData.payment_method  = paymentMethod
      updateData.amount_paid     = amountPaid
      updateData.deposit_amount  = deposit
      updateData.payment_note    = paymentNote || null
      updateData.paid_at         = new Date().toISOString()
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', selectedAppointment.id)

    if (error) {
      toast.error('Failed to save')
      setSavingPayment(false)
      return
    }

    toast.success(skipPayment ? 'Appointment marked complete!' : 'Complete & payment recorded!')
    setShowPaymentPrompt(false)
    setCompleteNotes('')
    setPaymentAmount('')
    setPaymentMethod('cash')
    setDepositAmount('')
    setPaymentNote('')

    // Determine Schedule Next state before closing detail dialog
    const completedAppt = selectedAppointment
    handleCloseDetailDialog()
    fetchData()
    setSavingPayment(false)

    if (completedAppt?.recurring_series_id) {
      // Find the next upcoming appointment in the series
      const { data: upcoming } = await supabase
        .from('appointments')
        .select('*, client:clients(*), pet:pets(*)')
        .eq('recurring_series_id', completedAppt.recurring_series_id)
        .eq('status', 'scheduled')
        .gt('scheduled_datetime', new Date().toISOString())
        .order('scheduled_datetime')
        .limit(1)
      if (upcoming && upcoming.length > 0) {
        setNextSeriesAppt(upcoming[0] as Appointment)
        setScheduleNextIsRecurring(true)
        setShowScheduleNext(true)
      }
    } else if (completedAppt) {
      // Non-recurring: suggest scheduling a follow-up
      const suggested = new Date(completedAppt.scheduled_datetime)
      suggested.setDate(suggested.getDate() + 28)
      const pad = (n: number) => String(n).padStart(2, '0')
      setScheduleNextDate(
        `${suggested.getFullYear()}-${pad(suggested.getMonth() + 1)}-${pad(suggested.getDate())}T${pad(new Date(completedAppt.scheduled_datetime).getHours())}:${pad(new Date(completedAppt.scheduled_datetime).getMinutes())}`
      )
      setCompletedApptRef({
        client_id: completedAppt.client_id,
        pet_id: completedAppt.pet_id,
        service_type: completedAppt.service_type,
        duration_minutes: completedAppt.duration_minutes,
        price: completedAppt.price != null ? String(completedAppt.price) : '',
      })
      setScheduleNextIsRecurring(false)
      setShowScheduleNext(true)
    }
  }

  async function handleSkipNextAppt() {
    if (scheduleNextIsRecurring && nextSeriesAppt) {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', nextSeriesAppt.id)
      fetchData()
      toast.success('Next appointment skipped')
    }
    setShowScheduleNext(false)
    setNextSeriesAppt(null)
    setCompletedApptRef(null)
  }

  async function handleScheduleOneOff() {
    if (!completedApptRef || !scheduleNextDate) return
    setSavingScheduleNext(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingScheduleNext(false); return }
    const { data: newAppt, error } = await supabase.from('appointments').insert({
      groomer_id: user.id,
      client_id: completedApptRef.client_id,
      pet_id: completedApptRef.pet_id,
      service_type: completedApptRef.service_type,
      scheduled_datetime: new Date(scheduleNextDate).toISOString(),
      duration_minutes: completedApptRef.duration_minutes,
      price: completedApptRef.price ? parseFloat(completedApptRef.price) : null,
    }).select('id').single()
    if (error) { toast.error(error.message); setSavingScheduleNext(false); return }
    toast.success('Next appointment scheduled!')
    if (newAppt?.id) {
      scheduleReminders(newAppt.id, user.id).catch(() => {})
      fetch('/api/appointments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: newAppt.id, groomerId: user.id }),
      }).catch(() => {})
    }
    fetchData()
    setSavingScheduleNext(false)
    setShowScheduleNext(false)
    setCompletedApptRef(null)
  }

  async function handlePauseSeries(seriesId: string) {
    if (!confirm('Cancel all future appointments in this series?')) return
    await supabase.from('appointments')
      .update({ status: 'cancelled' })
      .eq('recurring_series_id', seriesId)
      .eq('status', 'scheduled')
      .gt('scheduled_datetime', new Date().toISOString())
    toast.success('Series paused — future appointments cancelled')
    handleCloseDetailDialog()
    fetchData()
  }

  async function handleEndSeries(seriesId: string) {
    if (!confirm('End this recurring series? All future appointments will be cancelled and removed from the series.')) return
    await supabase.from('appointments')
      .update({ status: 'cancelled', recurring_series_id: null, is_recurring: false })
      .eq('recurring_series_id', seriesId)
      .eq('status', 'scheduled')
      .gt('scheduled_datetime', new Date().toISOString())
    toast.success('Series ended')
    handleCloseDetailDialog()
    fetchData()
  }

  async function handleEditSeries() {
    if (!selectedAppointment?.recurring_series_id) return
    setSavingSeriesEdit(true)
    const { error } = await supabase.from('appointments')
      .update({
        service_type: editSeriesForm.service_type,
        duration_minutes: editSeriesForm.duration_minutes,
        price: editSeriesForm.price ? parseFloat(editSeriesForm.price) : null,
        notes: editSeriesForm.notes || null,
      })
      .eq('recurring_series_id', selectedAppointment.recurring_series_id)
      .eq('status', 'scheduled')
      .gt('scheduled_datetime', new Date().toISOString())
    if (error) { toast.error(error.message); setSavingSeriesEdit(false); return }
    toast.success('All future appointments updated!')
    setShowEditSeries(false)
    setSavingSeriesEdit(false)
    fetchData()
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

  // In month view, clicking a day opens the day panel
  function handleMonthDayClick(day: number) {
    setDayPanelDate(new Date(year, month, day))
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
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 h-7 rounded"
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
        <div className="px-6 pb-4 border-b border-slate-800">
          <div className="inline-flex rounded-lg bg-slate-800 p-1 gap-1">
            {(['month', 'week', 'day'] as CalendarView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                  view === v
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {v}
              </button>
            ))}
          </div>
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
                            onClick={e => { e.stopPropagation(); handleSelectAppointment(appt) }}
                            title={`${new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · ${appt.pet?.name} · ${appt.service_type.replace('_', ' ')}`}
                            className="p-2 cursor-pointer flex-shrink-0 touch-manipulation"
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
            <div className="overflow-x-auto touch-pan-x">
              <div className="min-w-[770px]">
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
                            onClick={() => handleSelectAppointment(appt)}
                            className="flex items-start gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-slate-800 transition-colors"
                          >
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', getApptDotColor(appt))} />
                            <div className="min-w-0">
                              <div className={cn(
                                'text-xs font-medium leading-tight flex items-center gap-0.5',
                                appt.status === 'cancelled' ? 'text-slate-600 line-through' : 'text-slate-300'
                              )}>
                                {new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {appt.is_recurring && <span className="text-xs leading-none">🔄</span>}
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
              <div className="space-y-5 md:space-y-4">
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
                      onClick={() => handleSelectAppointment(appt)}
                      className={cn('p-5 md:p-6 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity touch-manipulation', colors.bg)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-sm font-semibold tabular-nums', colors.text)}>
                              {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span className="text-white font-medium">{appt.pet?.name}</span>
                            {appt.pet?.breed && <span className="text-slate-500 text-xs">{appt.pet.breed}</span>}
                            {appt.is_recurring && <span className="text-xs text-emerald-500" title="Recurring appointment">🔄</span>}
                            {isCompleted && <span className="text-emerald-400 text-xs">✓ completed</span>}
                            {isCancelled && <span className="text-slate-500 text-xs line-through">cancelled</span>}
                            {isCompleted && <PaymentBadge status={appt.payment_status} />}
                          </div>
                          <p className="text-slate-400 text-sm mt-1">
                            {appt.client?.first_name} {appt.client?.last_name}
                          </p>
                          <p className={cn('text-xs mt-2 capitalize', colors.text)}>
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
              <Select
                value={form.client_id}
                onValueChange={val => {
                  if (val === '__new_client__') {
                    setNewClientForm(BLANK_NEW_CLIENT)
                    setShowNewClientModal(true)
                  } else {
                    handleClientChange(val)
                  }
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-full">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white focus:bg-slate-700 focus:text-white">
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                  {!editingAppointmentId && (
                    <SelectItem value="__new_client__" className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300 border-t border-slate-700 mt-1">
                      + New Client
                    </SelectItem>
                  )}
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
                  <SelectItem value="bath" className="text-white focus:bg-slate-700 focus:text-white">🔵 Bath</SelectItem>
                  <SelectItem value="groom" className="text-white focus:bg-slate-700 focus:text-white">🟢 Groom</SelectItem>
                  <SelectItem value="deluxe" className="text-white focus:bg-slate-700 focus:text-white">🟠 Deluxe</SelectItem>
                  <SelectItem value="nail_trim" className="text-white focus:bg-slate-700 focus:text-white">🟣 Nail Trim</SelectItem>
                  <SelectItem value="other" className="text-white focus:bg-slate-700 focus:text-white">⚪ Other</SelectItem>
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

            {!editingAppointmentId && (
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Make Recurring</p>
                    <p className="text-slate-500 text-xs">Auto-schedules next 12 months</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                      form.is_recurring ? 'bg-emerald-600' : 'bg-slate-600'
                    )}
                  >
                    <span className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      form.is_recurring ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>
                {form.is_recurring && (
                  <Select value={form.recurring_frequency} onValueChange={v => setForm(f => ({ ...f, recurring_frequency: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val} className="text-white focus:bg-slate-700 focus:text-white">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

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
                {saving ? 'Saving...' : editingAppointmentId ? 'Update Appointment' : form.is_recurring ? '🔄 Schedule Recurring' : 'Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Client Modal */}
      <Dialog open={showNewClientModal} onOpenChange={open => { if (!open) { setShowNewClientModal(false); setNewClientForm(BLANK_NEW_CLIENT) } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-slate-300 text-xs">First Name *</Label>
                <Input
                  value={newClientForm.first_name}
                  onChange={e => setNewClientForm({ ...newClientForm, first_name: e.target.value })}
                  placeholder="First"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300 text-xs">Last Name *</Label>
                <Input
                  value={newClientForm.last_name}
                  onChange={e => setNewClientForm({ ...newClientForm, last_name: e.target.value })}
                  placeholder="Last"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Phone *</Label>
              <Input
                type="tel"
                value={newClientForm.phone}
                onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                placeholder="(555) 555-5555"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Email</Label>
              <Input
                type="email"
                value={newClientForm.email}
                onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })}
                placeholder="Optional"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                onClick={() => { setShowNewClientModal(false); setNewClientForm(BLANK_NEW_CLIENT) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNewClient}
                disabled={savingClient || !newClientForm.first_name || !newClientForm.last_name || !newClientForm.phone}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingClient ? 'Saving...' : 'Save Client'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Popup Warning Dialog */}
      <Dialog open={showSmartPopup} onOpenChange={setShowSmartPopup}>
        <DialogContent className="bg-slate-900 border-red-500/50 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Client Alerts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {popupWarnings.map((w, i) => (
              <div key={i} className={w.className}>{w.text}</div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowSmartPopup(false)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              {!isDNBClient && (
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  Proceed Anyway
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!selectedAppointment} onOpenChange={open => { if (!open) handleCloseDetailDialog() }}>
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
                  {isCompleted && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Payment</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <PaymentBadge status={appt.payment_status} />
                        {appt.amount_paid != null && (
                          <span className="text-sm text-white">${appt.amount_paid.toFixed(2)}</span>
                        )}
                        {appt.payment_method && (
                          <span className="text-xs text-slate-400 capitalize">{appt.payment_method}</span>
                        )}
                      </div>
                      {appt.payment_note && (
                        <p className="text-xs text-slate-400 italic">{appt.payment_note}</p>
                      )}
                    </div>
                  )}
                </div>
                {appt.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-slate-300 bg-slate-800 rounded-md px-3 py-2">{appt.notes}</p>
                  </div>
                )}
                {selectedApptNotifications.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Bell className="w-3 h-3" />
                      Reminders
                    </p>
                    <div className="space-y-1.5">
                      {selectedApptNotifications.map(n => (
                        <div key={n.id} className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 text-xs">
                            {new Date(n.scheduled_for).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' at '}
                            {new Date(n.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${
                            n.status === 'sent'    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            n.status === 'failed'  ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            n.status === 'skipped' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' :
                                                     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {n.status}
                          </span>
                        </div>
                      ))}
                    </div>
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
                {isCompleted && appt.payment_status !== 'paid' && (
                  <Button
                    onClick={() => {
                      setPaymentAmount(appt.amount_paid != null ? String(appt.amount_paid) : appt.price != null ? String(appt.price) : '')
                      setPaymentMethod(appt.payment_method ?? 'cash')
                      setDepositAmount(appt.deposit_amount != null ? String(appt.deposit_amount) : '')
                      setPaymentNote(appt.payment_note ?? '')
                      setCompleteNotes(appt.service_notes ?? '')
                      setShowPaymentPrompt(true)
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Record Payment
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

                {appt.is_recurring && appt.recurring_series_id && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">🔄 Recurring Series</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => {
                          setEditSeriesForm({
                            service_type: appt.service_type,
                            duration_minutes: appt.duration_minutes,
                            price: appt.price != null ? String(appt.price) : '',
                            notes: appt.notes ?? '',
                          })
                          setShowEditSeries(true)
                        }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm"
                      >
                        Edit Series
                      </Button>
                      <Button
                        onClick={() => handlePauseSeries(appt.recurring_series_id!)}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
                      >
                        Pause Series
                      </Button>
                      <Button
                        onClick={() => handleEndSeries(appt.recurring_series_id!)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm"
                      >
                        End Series
                      </Button>
                    </div>
                  </div>
                )}
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
                onClick={handleProceedToPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Next: Record Payment →
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentPrompt} onOpenChange={open => { if (!open) { setShowPaymentPrompt(false) } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Amount Paid ($)</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="cash" className="text-white focus:bg-slate-700 focus:text-white">💵 Cash</SelectItem>
                    <SelectItem value="card" className="text-white focus:bg-slate-700 focus:text-white">💳 Card</SelectItem>
                    <SelectItem value="venmo" className="text-white focus:bg-slate-700 focus:text-white">📱 Venmo</SelectItem>
                    <SelectItem value="zelle" className="text-white focus:bg-slate-700 focus:text-white">📲 Zelle</SelectItem>
                    <SelectItem value="other" className="text-white focus:bg-slate-700 focus:text-white">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedAppointment?.client?.deposit_required && (
              <div className="space-y-1">
                <Label className="text-slate-300">Deposit Applied ($) <span className="text-slate-500 font-normal">(optional)</span></Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-slate-300">Note <span className="text-slate-500 font-normal">(optional)</span></Label>
              <Input
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
                placeholder="e.g. Tip included, split payment..."
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleSaveCompletion(true)}
                disabled={savingPayment}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300"
              >
                Skip for Now
              </Button>
              <Button
                onClick={() => handleSaveCompletion(false)}
                disabled={savingPayment || !paymentAmount}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingPayment ? 'Saving...' : 'Save Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Next Dialog — shown after marking complete */}
      <Dialog open={showScheduleNext} onOpenChange={open => { if (!open) { setShowScheduleNext(false); setNextSeriesAppt(null); setCompletedApptRef(null) } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {scheduleNextIsRecurring ? '🔄 Next Recurring Appointment' : '📅 Schedule Next Visit?'}
            </DialogTitle>
          </DialogHeader>
          {scheduleNextIsRecurring && nextSeriesAppt ? (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Next appointment</p>
                <p className="text-white font-medium">
                  {new Date(nextSeriesAppt.scheduled_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-slate-400 text-sm">
                  {new Date(nextSeriesAppt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {nextSeriesAppt.pet && ` · ${nextSeriesAppt.pet.name}`}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSkipNextAppt} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300">
                  Skip This One
                </Button>
                <Button onClick={() => { setShowScheduleNext(false); setNextSeriesAppt(null) }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Confirmed ✓
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">Would you like to schedule their next appointment?</p>
              <div className="space-y-1">
                <Label className="text-slate-300">Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduleNextDate}
                  onChange={e => setScheduleNextDate(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setShowScheduleNext(false); setCompletedApptRef(null) }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300">
                  Skip
                </Button>
                <Button
                  onClick={handleScheduleOneOff}
                  disabled={savingScheduleNext || !scheduleNextDate}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingScheduleNext ? 'Scheduling...' : 'Schedule'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Series Dialog */}
      <Dialog open={showEditSeries} onOpenChange={open => { if (!open) setShowEditSeries(false) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              🔄 Edit Recurring Series
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm -mt-2">Updates all future scheduled appointments in this series.</p>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Service</Label>
              <Select value={editSeriesForm.service_type} onValueChange={v => setEditSeriesForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="bath" className="text-white focus:bg-slate-700 focus:text-white">🔵 Bath</SelectItem>
                  <SelectItem value="groom" className="text-white focus:bg-slate-700 focus:text-white">🟢 Groom</SelectItem>
                  <SelectItem value="deluxe" className="text-white focus:bg-slate-700 focus:text-white">🟠 Deluxe</SelectItem>
                  <SelectItem value="nail_trim" className="text-white focus:bg-slate-700 focus:text-white">🟣 Nail Trim</SelectItem>
                  <SelectItem value="other" className="text-white focus:bg-slate-700 focus:text-white">⚪ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Duration (min)</Label>
                <Input type="number" value={editSeriesForm.duration_minutes} onChange={e => setEditSeriesForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))} className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Price ($)</Label>
                <Input type="number" value={editSeriesForm.price} onChange={e => setEditSeriesForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea value={editSeriesForm.notes} onChange={e => setEditSeriesForm(f => ({ ...f, notes: e.target.value }))} className="bg-slate-800 border-slate-600 text-white resize-none" rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowEditSeries(false)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Cancel</Button>
              <Button onClick={handleEditSeries} disabled={savingSeriesEdit} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {savingSeriesEdit ? 'Saving...' : 'Update Series'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day-click panel */}
      {dayPanelDate && (() => {
        const panelAppts = getApptsForDate(dayPanelDate)
        const pad = (n: number) => String(n).padStart(2, '0')
        const prefill = `${dayPanelDate.getFullYear()}-${pad(dayPanelDate.getMonth() + 1)}-${pad(dayPanelDate.getDate())}T09:00`
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setDayPanelDate(null)}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div>
                  <p className="text-white font-semibold">
                    {dayPanelDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {panelAppts.length} appointment{panelAppts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => setDayPanelDate(null)} className="text-slate-400 hover:text-white p-1 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {panelAppts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-slate-500 text-sm mb-3">No appointments</p>
                  </div>
                ) : (
                  panelAppts.map(appt => {
                    const dotColor = getApptDotColor(appt)
                    return (
                      <button
                        key={appt.id}
                        onClick={() => { setDayPanelDate(null); handleSelectAppointment(appt) }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors"
                      >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{appt.pet?.name}</p>
                          <p className="text-slate-400 text-xs truncate">
                            {(appt.client as any)?.first_name} {(appt.client as any)?.last_name} · {appt.service_type.replace('_', ' ')}
                          </p>
                        </div>
                        <p className="text-slate-300 text-sm flex-shrink-0">
                          {new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="px-4 pb-4 pt-3 border-t border-slate-800 flex gap-2">
                {panelAppts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-slate-400 hover:text-white"
                    onClick={() => { setDayPanelDate(null); setCurrentDate(dayPanelDate); setView('day') }}
                  >
                    View Day
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setDayPanelDate(null); openAddDialog(prefill) }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Schedule
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

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
