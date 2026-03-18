'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, User, Phone, Mail, MapPin, Globe } from 'lucide-react'
import { toast } from 'sonner'

const US_TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET)' },
  { value: 'America/Chicago',     label: 'Central Time (CT)' },
  { value: 'America/Denver',      label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix',     label: 'Mountain Time – Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii Time (HT)' },
]

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const inputClass =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors'

const labelClass = 'block text-slate-300 text-sm font-medium mb-1.5'

export default function ProfilePage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [firstName, setFirstName]       = useState('')
  const [lastName, setLastName]         = useState('')
  const [phone, setPhone]               = useState('')
  const [email, setEmail]               = useState('')
  const [address, setAddress]           = useState('')
  const [timezone, setTimezone]         = useState('America/New_York')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('groomer_profiles')
        .select('business_name, first_name, last_name, phone, email, address, timezone')
        .eq('id', user.id)
        .single()

      if (data) {
        setBusinessName(data.business_name ?? '')
        setFirstName(data.first_name ?? '')
        setLastName(data.last_name ?? '')
        setPhone(data.phone ? formatPhone(data.phone) : '')
        setEmail(data.email ?? user.email ?? '')
        setAddress(data.address ?? '')
        setTimezone(data.timezone ?? 'America/New_York')
      } else {
        setEmail(user.email ?? '')
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (saving) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const rawPhone = phone.replace(/\D/g, '')
    const phoneE164 = rawPhone.length === 10 ? `+1${rawPhone}` : rawPhone.length === 11 && rawPhone.startsWith('1') ? `+${rawPhone}` : rawPhone || null

    const { error } = await supabase
      .from('groomer_profiles')
      .upsert({
        id: user.id,
        email,
        business_name: businessName,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phoneE164,
        address: address || null,
        timezone,
      })

    if (error) {
      toast.error('Failed to save — please try again')
    } else {
      toast.success('Profile saved!')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-slate-400">Your business and contact information</p>
        </div>
        <div className="py-12 text-center text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-slate-400">Your business and contact information</p>
      </div>

      {/* Business Info */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <CardTitle className="text-white">Business</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className={labelClass}>Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="My Grooming Salon"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Business Address <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Springfield, IL 62701"
              className={inputClass}
            />
          </div>
        </CardContent>
      </Card>

      {/* Owner Info */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <CardTitle className="text-white">Owner / Groomer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Smith"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              <Mail className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              <Phone className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 555-5555"
              className={inputClass}
            />
            <p className="text-slate-500 text-xs mt-1.5">Used for SMS notifications and test messages</p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <CardTitle className="text-white">Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <label className={labelClass}>Time Zone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className={inputClass}
            >
              {US_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  )
}
