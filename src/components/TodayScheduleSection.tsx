'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Plus, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { scheduleReminders } from '@/lib/scheduleReminders'

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

const serviceColors: Record<string, string> = {
  bath: 'bg-blue-500', groom: 'bg-emerald-500',
  deluxe: 'bg-orange-500', nail_trim: 'bg-purple-500', other: 'bg-slate-500',
}

interface Props {
  initialAppts: any[]
}

export default function TodayScheduleSection({ initialAppts }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSmartPopup, setShowSmartPopup] = useState(false)
  const [popupWarnings, setPopupWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [clients, setClients] = useState<any[]>([])
  const [clientPets, setClientPets] = useState<any[]>([])
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientForm, setNewClientForm] = useState(BLANK_NEW_CLIENT)
  const [savingClient, setSavingClient] = useState(false)
  const [showNewPetForm, setShowNewPetForm] = useState(false)
  const [newPetForm, setNewPetForm] = useState(BLANK_NEW_PET)
  const [savingPet, setSavingPet] = useState(false)

  async function openAddDialog() {
    const { data } = await supabase.from('clients').select('*').order('last_name')
    setClients(data ?? [])
    setForm(BLANK_FORM)
    setClientPets([])
    setShowAddDialog(true)
  }

  function handleCloseAddDialog() {
    setShowAddDialog(false)
    setForm(BLANK_FORM)
    setClientPets([])
    setShowNewClientForm(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
  }

  async function fetchPetsForClient(clientId: string) {
    const { data } = await supabase.from('pets').select('*').eq('client_id', clientId)
    setClientPets(data ?? [])
  }

  function handleClientChange(clientId: string) {
    setForm(f => ({ ...f, client_id: clientId, pet_id: '' }))
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
    fetchPetsForClient(clientId)
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

  async function handleSave() {
    setSaving(true)
    setShowSmartPopup(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data: newAppt, error } = await supabase.from('appointments').insert({
      groomer_id: user.id,
      client_id: form.client_id,
      pet_id: form.pet_id,
      service_type: form.service_type,
      scheduled_datetime: new Date(form.scheduled_datetime).toISOString(),
      duration_minutes: form.duration_minutes,
      price: form.price ? parseFloat(form.price) : null,
      notes: form.notes,
    }).select('id').single()

    if (error) {
      toast.error('Failed to save appointment')
      setSaving(false)
      return
    }

    toast.success('Appointment scheduled!')
    handleCloseAddDialog()
    router.refresh()
    setSaving(false)
    if (newAppt?.id) scheduleReminders(newAppt.id, user.id).catch(() => {})
  }

  async function handleSaveNewClient() {
    if (!newClientForm.first_name || !newClientForm.last_name || !newClientForm.phone) return
    setSavingClient(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingClient(false); return }

    const { data: newClient, error } = await supabase.from('clients').insert({
      groomer_id: user.id,
      first_name: newClientForm.first_name,
      last_name: newClientForm.last_name,
      phone: newClientForm.phone,
      email: newClientForm.email || null,
    }).select().single()

    if (error) { toast.error(error.message); setSavingClient(false); return }

    toast.success(`${newClient.first_name} added!`)
    setClients(prev => [...prev, newClient].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    setForm(f => ({ ...f, client_id: newClient.id }))
    fetchPetsForClient(newClient.id)
    setShowNewClientForm(false)
    setNewClientForm(BLANK_NEW_CLIENT)
    setSavingClient(false)
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

    toast.success(`${newPet.name} added!`)
    setClientPets(prev => [...prev, newPet])
    setForm(f => ({ ...f, pet_id: newPet.id }))
    setShowNewPetForm(false)
    setNewPetForm(BLANK_NEW_PET)
    setSavingPet(false)
  }

  return (
    <>
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Today&apos;s Schedule</CardTitle>
          {initialAppts.length > 0 && (
            <Button
              onClick={openAddDialog}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2 gap-1"
            >
              <Plus className="w-3 h-3" />
              New
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {initialAppts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No appointments today</p>
              <Button
                onClick={openAddDialog}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Appointment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {initialAppts.map((appt: any) => (
                <div key={appt.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-800 border border-slate-700 min-h-[64px]">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${serviceColors[appt.service_type] ?? 'bg-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{appt.pet?.name} — {appt.client?.first_name} {appt.client?.last_name}</p>
                    <p className="text-slate-400 text-sm capitalize">{appt.service_type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm">{new Date(appt.scheduled_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                    {appt.price && <p className="text-emerald-400 text-sm">${appt.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Appointment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) handleCloseAddDialog() }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Schedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Client */}
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
                        <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowNewClientForm(v => !v); setNewClientForm(BLANK_NEW_CLIENT) }}
                  className={cn(
                    'flex items-center gap-1 text-xs px-3 py-2 rounded-md border whitespace-nowrap transition-colors flex-shrink-0',
                    showNewClientForm
                      ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                      : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                  )}
                >
                  {showNewClientForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Add Client</>}
                </button>
              </div>
            </div>

            {showNewClientForm && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                <p className="text-xs font-medium text-slate-400">New Client</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">First Name *</Label>
                    <Input value={newClientForm.first_name} onChange={e => setNewClientForm({ ...newClientForm, first_name: e.target.value })} placeholder="First" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Last Name *</Label>
                    <Input value={newClientForm.last_name} onChange={e => setNewClientForm({ ...newClientForm, last_name: e.target.value })} placeholder="Last" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Phone *</Label>
                  <Input type="tel" value={newClientForm.phone} onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })} placeholder="(555) 555-5555" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Email</Label>
                  <Input type="email" value={newClientForm.email} onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })} placeholder="Optional" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" onClick={() => { setShowNewClientForm(false); setNewClientForm(BLANK_NEW_CLIENT) }} className="flex-1 h-8 text-sm bg-red-600 hover:bg-red-700 text-white">Cancel</Button>
                  <Button type="button" onClick={handleSaveNewClient} disabled={savingClient || !newClientForm.first_name || !newClientForm.last_name || !newClientForm.phone} className="flex-1 h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">{savingClient ? 'Saving...' : 'Save Client'}</Button>
                </div>
              </div>
            )}

            {/* Pet */}
            {form.client_id && (
              <div className="space-y-1">
                <Label className="text-slate-300">Pet *</Label>
                {clientPets.length > 0 ? (
                  <Select value={form.pet_id} onValueChange={v => setForm(f => ({ ...f, pet_id: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                      <SelectValue placeholder="Select pet..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {clientPets.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.breed ?? p.species})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div>
                    <div className="text-sm text-slate-400 bg-slate-800 border border-slate-600 rounded-md px-3 py-2 flex items-center justify-between">
                      <span>No pets found</span>
                      <button type="button" onClick={() => setShowNewPetForm(v => !v)}
                        className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded border whitespace-nowrap transition-colors',
                          showNewPetForm ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                        )}>
                        {showNewPetForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Add Pet</>}
                      </button>
                    </div>
                    {showNewPetForm && (
                      <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
                        <p className="text-xs font-medium text-slate-400">New Pet</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-slate-400 text-xs">Name *</Label>
                            <Input value={newPetForm.name} onChange={e => setNewPetForm({ ...newPetForm, name: e.target.value })} placeholder="Buddy" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-slate-400 text-xs">Species</Label>
                            <Select value={newPetForm.species} onValueChange={v => setNewPetForm({ ...newPetForm, species: v })}>
                              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-8 text-sm"><SelectValue /></SelectTrigger>
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
                          <Input value={newPetForm.breed} onChange={e => setNewPetForm({ ...newPetForm, breed: e.target.value })} placeholder="Golden Retriever" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button type="button" onClick={() => { setShowNewPetForm(false); setNewPetForm(BLANK_NEW_PET) }} className="flex-1 h-8 text-sm bg-red-600 hover:bg-red-700 text-white">Cancel</Button>
                          <Button type="button" onClick={handleSaveNewPet} disabled={savingPet || !newPetForm.name} className="flex-1 h-8 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">{savingPet ? 'Saving...' : 'Save Pet'}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Service */}
            <div className="space-y-1">
              <Label className="text-slate-300">Service *</Label>
              <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="bath">🔵 Bath</SelectItem>
                  <SelectItem value="groom">🟢 Groom</SelectItem>
                  <SelectItem value="deluxe">🟠 Deluxe</SelectItem>
                  <SelectItem value="nail_trim">🟣 Nail Trim</SelectItem>
                  <SelectItem value="other">⚪ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="space-y-1">
              <Label className="text-slate-300">Date & Time *</Label>
              <Input type="datetime-local" value={form.scheduled_datetime} onChange={e => setForm(f => ({ ...f, scheduled_datetime: e.target.value }))} className="bg-slate-800 border-slate-600 text-white" />
            </div>

            {/* Duration + Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Duration (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))} className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Price ($)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-slate-800 border-slate-600 text-white resize-none" rows={2} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleCloseAddDialog} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Cancel</Button>
              <Button onClick={handleBookClick} disabled={saving || !form.client_id || !form.pet_id || !form.scheduled_datetime} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? 'Saving...' : 'Schedule'}
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
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200">{w}</div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setShowSmartPopup(false)} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Cancel</Button>
              <Button onClick={handleSave} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white">Proceed Anyway</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
