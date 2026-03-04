'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Client } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Search, Phone, Mail, AlertTriangle, MessageSquareOff, DollarSign, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    status: 'active' as Client['status'],
    no_text_messages: false,
    deposit_required: false,
    notes: '',
  })

  async function fetchClients() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('groomer_id', user.id)
      .order('last_name')

    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchClients() }, [])

  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('clients').insert({
      ...form,
      groomer_id: user.id,
    })

    if (error) {
      toast.error('Failed to save client')
      setSaving(false)
      return
    }

    toast.success(`${form.first_name} ${form.last_name} added!`)
    setShowAddDialog(false)
    setForm({
      first_name: '', last_name: '', phone: '', email: '',
      address: '', status: 'active', no_text_messages: false,
      deposit_required: false, notes: '',
    })
    fetchClients()
    setSaving(false)
  }

  const statusBadge = (status: Client['status']) => {
    const map = {
      active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      do_not_book: 'bg-red-500/20 text-red-400 border-red-500/30',
      deposit_required: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    }
    const labels = {
      active: 'Active',
      inactive: 'Inactive',
      do_not_book: 'DNB',
      deposit_required: 'Deposit Required',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status]}`}>{labels[status]}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-400">{clients.length} total clients</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading clients...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {search ? 'No clients match your search' : 'No clients yet — add your first one!'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">
                        {client.first_name} {client.last_name}
                      </p>
                      {statusBadge(client.status)}
                      {client.no_text_messages && (
                        <span title="No text messages">
                          <MessageSquareOff className="w-4 h-4 text-orange-400" />
                        </span>
                      )}
                      {client.deposit_required && (
                        <span title="Deposit required">
                          <DollarSign className="w-4 h-4 text-yellow-400" />
                        </span>
                      )}
                      {client.status === 'do_not_book' && (
                        <span title="Do not book">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-slate-400 text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {client.phone}
                      </span>
                      {client.email && (
                        <span className="text-slate-400 text-sm flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">First Name *</Label>
                <Input
                  value={form.first_name}
                  onChange={e => setForm({ ...form, first_name: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Last Name *</Label>
                <Input
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Phone *</Label>
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 555-5555"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Email</Label>
              <Input
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                type="email"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Client['status'] })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="deposit_required">Deposit Required</SelectItem>
                  <SelectItem value="do_not_book">Do Not Book</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.no_text_messages}
                  onChange={e => setForm({ ...form, no_text_messages: e.target.checked })}
                  className="rounded"
                />
                <span className="text-slate-300 text-sm">No Text Messages</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.deposit_required}
                  onChange={e => setForm({ ...form, deposit_required: e.target.checked })}
                  className="rounded"
                />
                <span className="text-slate-300 text-sm">Deposit Required</span>
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any important notes about this client..."
                className="bg-slate-800 border-slate-600 text-white resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.first_name || !form.last_name || !form.phone}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? 'Saving...' : 'Add Client'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
