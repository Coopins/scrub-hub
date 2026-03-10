'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Client, Pet } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Phone, Mail, MapPin, Edit, Dog, AlertTriangle, MessageSquareOff, DollarSign, Trash2, Calendar, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { scheduleReminders } from '@/lib/scheduleReminders'

const emptyPetForm = {
  name: '', species: 'dog', breed: '', age: '', weight: '',
  temperament_notes: '', medical_notes: '',
}

const BLANK_APPT_FORM = {
  pet_id: '',
  service_type: 'groom',
  scheduled_datetime: '',
  duration_minutes: 90,
  price: '',
  notes: '',
}

type PetFormData = typeof emptyPetForm

// Defined OUTSIDE the page component so React sees a stable component type across
// renders. Defining it inside would create a new function reference every render,
// causing React to unmount/remount the form on every keystroke (the one-char bug).
function PetForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  title,
  saving,
}: {
  form: PetFormData
  setForm: (f: PetFormData) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  title: string
  saving: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-slate-300">Name *</Label>
          <Input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            className="bg-slate-800 border-slate-600 text-white"
            placeholder="Buddy"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Species</Label>
          <Select value={form.species} onValueChange={v => setForm({ ...form, species: v })}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="dog" className="text-white focus:bg-slate-700 focus:text-white">🐕 Dog</SelectItem>
              <SelectItem value="cat" className="text-white focus:bg-slate-700 focus:text-white">🐈 Cat</SelectItem>
              <SelectItem value="other" className="text-white focus:bg-slate-700 focus:text-white">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-slate-300">Breed</Label>
        <Input
          value={form.breed}
          onChange={e => setForm({ ...form, breed: e.target.value })}
          className="bg-slate-800 border-slate-600 text-white"
          placeholder="Golden Retriever"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-slate-300">Age (years)</Label>
          <Input
            type="number"
            min="0"
            max="30"
            value={form.age}
            onChange={e => setForm({ ...form, age: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            placeholder="3"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Weight (lbs)</Label>
          <Input
            type="number"
            min="0"
            max="300"
            value={form.weight}
            onChange={e => setForm({ ...form, weight: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            placeholder="45"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-slate-300">Temperament Notes</Label>
        <Textarea
          value={form.temperament_notes}
          onChange={e => setForm({ ...form, temperament_notes: e.target.value })}
          className="bg-slate-800 border-slate-600 text-white"
          placeholder="Dog aggressive, anxious, loves treats..."
          rows={2}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-slate-300">Medical Notes</Label>
        <Textarea
          value={form.medical_notes}
          onChange={e => setForm({ ...form, medical_notes: e.target.value })}
          className="bg-slate-800 border-slate-600 text-white"
          placeholder="Arthritis in hips, heart murmur..."
          rows={2}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
          {saving ? 'Saving...' : title}
        </Button>
      </div>
    </form>
  )
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showAddPet, setShowAddPet] = useState(false)
  const [showEditPet, setShowEditPet] = useState(false)
  const [showEditClient, setShowEditClient] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [showNoPetsNotice, setShowNoPetsNotice] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [petJustAdded, setPetJustAdded] = useState<string | null>(null)

  const [petForm, setPetForm] = useState(emptyPetForm)
  const [editPetForm, setEditPetForm] = useState(emptyPetForm)
  const [apptForm, setApptForm] = useState(BLANK_APPT_FORM)
  const [savingAppt, setSavingAppt] = useState(false)

  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '', email: '', address: '',
    status: 'active' as string, no_text_messages: false, deposit_required: false, notes: '',
  })

  async function fetchAll() {
    const { data: clientData } = await supabase
      .from('clients').select('*').eq('id', clientId).single()
    if (!clientData) { router.push('/clients'); return }
    setClient(clientData)
    setEditForm({
      first_name: clientData.first_name,
      last_name: clientData.last_name,
      phone: clientData.phone,
      email: clientData.email ?? '',
      address: clientData.address ?? '',
      status: clientData.status,
      no_text_messages: clientData.no_text_messages,
      deposit_required: clientData.deposit_required,
      notes: clientData.notes ?? '',
    })
    const { data: petsData } = await supabase
      .from('pets').select('*').eq('client_id', clientId).order('name')
    setPets(petsData ?? [])
    const { data: apptData } = await supabase
      .from('appointments').select('*, pet:pets(*)')
      .eq('client_id', clientId)
      .order('scheduled_datetime', { ascending: false }).limit(10)
    setAppointments(apptData ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [clientId])

  function openEditPet(pet: Pet) {
    setEditingPet(pet)
    setEditPetForm({
      name: pet.name,
      species: pet.species ?? 'dog',
      breed: pet.breed ?? '',
      age: pet.age?.toString() ?? '',
      weight: pet.weight?.toString() ?? '',
      temperament_notes: pet.temperament_notes ?? '',
      medical_notes: pet.medical_notes ?? '',
    })
    setShowEditPet(true)
  }

  async function handleAddPet(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const savedName = petForm.name
    const { error } = await supabase.from('pets').insert({
      client_id: clientId,
      name: savedName,
      species: petForm.species,
      breed: petForm.breed || null,
      age: petForm.age ? parseInt(petForm.age) : null,
      weight: petForm.weight ? parseFloat(petForm.weight) : null,
      temperament_notes: petForm.temperament_notes || null,
      medical_notes: petForm.medical_notes || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(`${savedName} added!`)
    setPetJustAdded(savedName)
    setPetForm(emptyPetForm)
    fetchAll()
    setSaving(false)
  }

  function handleScheduleClick() {
    if (pets.length === 0) {
      setShowNoPetsNotice(true)
      return
    }
    const prefillPetId = pets.length === 1 ? pets[0].id : ''
    setApptForm({ ...BLANK_APPT_FORM, pet_id: prefillPetId })
    setShowScheduleDialog(true)
  }

  async function handleSaveAppt() {
    if (!apptForm.pet_id || !apptForm.scheduled_datetime) return
    setSavingAppt(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingAppt(false); return }
    const { data: newAppt, error } = await supabase.from('appointments').insert({
      groomer_id: user.id,
      client_id: clientId,
      pet_id: apptForm.pet_id,
      service_type: apptForm.service_type,
      scheduled_datetime: new Date(apptForm.scheduled_datetime).toISOString(),
      duration_minutes: apptForm.duration_minutes,
      price: apptForm.price ? parseFloat(apptForm.price) : null,
      notes: apptForm.notes,
    }).select('id').single()
    if (error) { toast.error(error.message); setSavingAppt(false); return }
    toast.success('Appointment scheduled!')
    setShowScheduleDialog(false)
    setApptForm(BLANK_APPT_FORM)
    fetchAll()
    setSavingAppt(false)
    if (newAppt?.id) {
      scheduleReminders(newAppt.id, user.id).catch(() => {})
      fetch('/api/appointments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: newAppt.id, groomerId: user.id }),
      }).catch(() => {})
    }
  }

  async function handleEditPet(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPet) return
    setSaving(true)
    const { error } = await supabase.from('pets').update({
      name: editPetForm.name,
      species: editPetForm.species,
      breed: editPetForm.breed || null,
      age: editPetForm.age ? parseInt(editPetForm.age) : null,
      weight: editPetForm.weight ? parseFloat(editPetForm.weight) : null,
      temperament_notes: editPetForm.temperament_notes || null,
      medical_notes: editPetForm.medical_notes || null,
    }).eq('id', editingPet.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(`${editPetForm.name} updated!`)
    setShowEditPet(false)
    setEditingPet(null)
    fetchAll()
    setSaving(false)
  }

  async function handleDeletePet(pet: Pet) {
    if (!confirm(`Remove ${pet.name}? This cannot be undone.`)) return
    const { error } = await supabase.from('pets').delete().eq('id', pet.id)
    if (error) { toast.error(error.message); return }
    toast.success(`${pet.name} removed`)
    fetchAll()
  }

  async function handleEditClient(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').update(editForm).eq('id', clientId)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Client updated!')
    setShowEditClient(false)
    fetchAll()
    setSaving(false)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      do_not_book: 'bg-red-500/20 text-red-400 border-red-500/30',
      deposit_required: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    }
    const labels: Record<string, string> = {
      active: 'Active', inactive: 'Inactive', do_not_book: 'DNB', deposit_required: 'Deposit Required',
    }
    return (
      <span className={`text-xs px-2 py-1 rounded border font-medium ${map[status] ?? ''}`}>
        {labels[status] ?? status}
      </span>
    )
  }

  const serviceColors: Record<string, string> = {
    bath: 'bg-blue-500', groom: 'bg-emerald-500',
    deluxe: 'bg-orange-500', nail_trim: 'bg-purple-500', other: 'bg-slate-500',
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-slate-400">Loading...</div></div>
  if (!client) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{client.first_name} {client.last_name}</h1>
            {statusBadge(client.status)}
            {client.no_text_messages && <span title="No text messages"><MessageSquareOff className="w-4 h-4 text-yellow-400" /></span>}
            {client.deposit_required && <span title="Deposit required"><DollarSign className="w-4 h-4 text-yellow-400" /></span>}
          </div>
        </div>
        <Button
          onClick={() => setShowEditClient(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
        >
          <Edit className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Edit</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white text-sm">Contact Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" /><span>{client.phone}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500" /><span>{client.email}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-500" /><span>{client.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(client.status === 'do_not_book' || client.no_text_messages || client.deposit_required) && (
            <Card className="bg-red-950/30 border-red-800/50">
              <CardHeader>
                <CardTitle className="text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.status === 'do_not_book' && <p className="text-red-300 text-sm">⛔ Do Not Book</p>}
                {client.no_text_messages && <p className="text-yellow-300 text-sm">📵 No Text Messages — Call to confirm</p>}
                {client.deposit_required && <p className="text-yellow-300 text-sm">💰 Deposit Required before scheduling</p>}
              </CardContent>
            </Card>
          )}

          {client.notes && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader><CardTitle className="text-white text-sm">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-slate-300 text-sm whitespace-pre-wrap">{client.notes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pets */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Pets ({pets.length})</CardTitle>
              <Button size="sm" onClick={() => setShowAddPet(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 md:h-8 px-4 md:px-3">
                <Plus className="w-4 h-4 mr-1" /> Add Pet
              </Button>
            </CardHeader>
            <CardContent>
              {pets.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <Dog className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No pets yet — add one to start scheduling</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pets.map(pet => (
                    <div key={pet.id} className="p-5 md:p-4 rounded-lg bg-slate-800 border border-slate-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{pet.name}</p>
                          <p className="text-slate-400 text-sm">
                            {pet.breed ?? pet.species}{pet.age && ` · ${pet.age}yr`}{pet.weight && ` · ${pet.weight}lbs`}
                          </p>
                          {pet.temperament_notes && <p className="text-yellow-300 text-sm mt-2">⚠️ {pet.temperament_notes}</p>}
                          {pet.medical_notes && <p className="text-blue-300 text-sm mt-1">🏥 {pet.medical_notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditPet(pet)}
                            className="w-10 h-10 md:w-7 md:h-7 text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <Edit className="w-4 h-4 md:w-3.5 md:h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeletePet(pet)}
                            className="w-10 h-10 md:w-7 md:h-7 text-slate-400 hover:text-red-400 hover:bg-red-950/30"
                          >
                            <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointment History */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Appointment History</CardTitle>
              <Button size="sm" onClick={handleScheduleClick} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 md:h-8 px-4 md:px-3">
                <Calendar className="w-4 h-4 mr-1" /> Schedule
              </Button>
            </CardHeader>
            <CardContent>
              {showNoPetsNotice && (
                <div className="mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700 flex items-start gap-3">
                  <Dog className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm">Add a pet to this client before scheduling an appointment.</p>
                    <Button
                      size="sm"
                      onClick={() => { setShowNoPetsNotice(false); setShowAddPet(true) }}
                      className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Pet
                    </Button>
                  </div>
                  <button onClick={() => setShowNoPetsNotice(false)} className="text-slate-500 hover:text-slate-300 text-lg leading-none flex-shrink-0">×</button>
                </div>
              )}
              {appointments.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No appointments yet</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map(appt => (
                    <div key={appt.id} className="flex items-center gap-3 p-4 md:p-3 rounded-lg bg-slate-800 border border-slate-700 min-h-[60px]">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${serviceColors[appt.service_type] ?? 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">
                          {appt.pet?.name} — <span className="capitalize">{appt.service_type.replace('_', ' ')}</span>
                        </p>
                        <p className="text-slate-400 text-xs">
                          {new Date(appt.scheduled_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {appt.service_notes && <p className="text-slate-300 text-xs mt-1 italic">"{appt.service_notes}"</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded ${appt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : appt.status === 'no_show' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                          {appt.status}
                        </span>
                        {appt.price && <p className="text-emerald-400 text-sm mt-1">${appt.price}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Pet Dialog */}
      <Dialog open={showAddPet} onOpenChange={open => { if (!open) { setShowAddPet(false); setPetJustAdded(null); setPetForm(emptyPetForm) } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">Add Pet</DialogTitle></DialogHeader>
          {petJustAdded ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-medium">{petJustAdded} added!</p>
                <p className="text-slate-400 text-sm mt-1">Pet saved successfully.</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => { setShowAddPet(false); setPetJustAdded(null) }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
                >
                  Done
                </Button>
                <Button
                  onClick={() => setPetJustAdded(null)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Another Pet
                </Button>
              </div>
            </div>
          ) : (
            <PetForm
              form={petForm}
              setForm={setPetForm}
              onSubmit={handleAddPet}
              onCancel={() => { setShowAddPet(false); setPetJustAdded(null) }}
              title="Add Pet"
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Pet Dialog */}
      <Dialog open={showEditPet} onOpenChange={setShowEditPet}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">Edit {editingPet?.name}</DialogTitle></DialogHeader>
          <PetForm
            form={editPetForm}
            setForm={setEditPetForm}
            onSubmit={handleEditPet}
            onCancel={() => { setShowEditPet(false); setEditingPet(null) }}
            title="Save Changes"
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Schedule Appointment Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={open => { if (!open) { setShowScheduleDialog(false); setApptForm(BLANK_APPT_FORM) } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Schedule Appointment</DialogTitle>
            <p className="text-slate-400 text-sm">{client?.first_name} {client?.last_name}</p>
          </DialogHeader>
          <div className="space-y-4">
            {/* Pet — locked if 1 pet, dropdown if 2+ */}
            <div className="space-y-1">
              <Label className="text-slate-300">Pet *</Label>
              {pets.length === 1 ? (
                <div className="bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white text-sm">
                  {pets[0].name} ({pets[0].breed ?? pets[0].species})
                </div>
              ) : (
                <Select value={apptForm.pet_id} onValueChange={v => setApptForm({ ...apptForm, pet_id: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select pet..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {pets.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700 focus:text-white">
                        {p.name} ({p.breed ?? p.species})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Service *</Label>
              <Select value={apptForm.service_type} onValueChange={v => setApptForm({ ...apptForm, service_type: v })}>
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
                value={apptForm.scheduled_datetime}
                onChange={e => setApptForm({ ...apptForm, scheduled_datetime: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Duration (min)</Label>
                <Input
                  type="number"
                  value={apptForm.duration_minutes}
                  onChange={e => setApptForm({ ...apptForm, duration_minutes: parseInt(e.target.value) })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Price ($)</Label>
                <Input
                  type="number"
                  value={apptForm.price}
                  onChange={e => setApptForm({ ...apptForm, price: e.target.value })}
                  placeholder="0.00"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={apptForm.notes}
                onChange={e => setApptForm({ ...apptForm, notes: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => { setShowScheduleDialog(false); setApptForm(BLANK_APPT_FORM) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAppt}
                disabled={savingAppt || !apptForm.pet_id || !apptForm.scheduled_datetime}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingAppt ? 'Saving...' : 'Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={showEditClient} onOpenChange={setShowEditClient}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">Edit Client</DialogTitle></DialogHeader>
          <form onSubmit={handleEditClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">First Name *</Label>
                <Input
                  value={editForm.first_name}
                  onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  required
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Last Name *</Label>
                <Input
                  value={editForm.last_name}
                  onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  required
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Phone *</Label>
              <Input
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                required
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Email</Label>
              <Input
                value={editForm.email}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Address</Label>
              <Input
                value={editForm.address}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="active" className="text-white focus:bg-slate-700 focus:text-white">Active</SelectItem>
                  <SelectItem value="inactive" className="text-white focus:bg-slate-700 focus:text-white">Inactive</SelectItem>
                  <SelectItem value="deposit_required" className="text-white focus:bg-slate-700 focus:text-white">Deposit Required</SelectItem>
                  <SelectItem value="do_not_book" className="text-white focus:bg-slate-700 focus:text-white">Do Not Book</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.no_text_messages}
                  onChange={e => setEditForm({ ...editForm, no_text_messages: e.target.checked })}
                  className="rounded"
                />
                <span className="text-slate-300 text-sm">No Text Messages</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.deposit_required}
                  onChange={e => setEditForm({ ...editForm, deposit_required: e.target.checked })}
                  className="rounded"
                />
                <span className="text-slate-300 text-sm">Deposit Required</span>
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setShowEditClient(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
