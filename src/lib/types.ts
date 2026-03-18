export type ClientStatus = 'active' | 'inactive' | 'do_not_book' | 'deposit_required'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
export type ServiceType = 'bath' | 'groom' | 'deluxe' | 'nail_trim' | 'other'

export interface GroomerProfile {
  id: string
  email: string
  business_name: string
  phone?: string
  created_at: string
}

export interface Client {
  id: string
  groomer_id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  address?: string
  status: ClientStatus
  no_text_messages: boolean
  deposit_required: boolean
  dog_aggressive: boolean
  unpaid_balance: number
  notes?: string
  created_at: string
  pets?: Pet[]
}

export interface Pet {
  id: string
  client_id: string
  name: string
  breed?: string
  species: string
  age?: number
  weight?: number
  photo_url?: string
  temperament_notes?: string
  medical_notes?: string
  created_at: string
  client?: Client
}

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface Notification {
  id: string
  appointment_id: string
  groomer_id: string
  type: string
  scheduled_for: string
  sent_at: string | null
  status: NotificationStatus
  message_body: string | null
  created_at: string
}

export type PaymentStatus = 'unpaid' | 'paid' | 'partial'
export type PaymentMethod = 'cash' | 'card' | 'venmo' | 'zelle' | 'other'

export interface Appointment {
  id: string
  groomer_id: string
  client_id: string
  pet_id: string
  service_type: ServiceType
  scheduled_datetime: string
  duration_minutes: number
  status: AppointmentStatus
  price?: number
  notes?: string
  service_notes?: string
  color_code?: string
  reminder_sent: boolean
  created_at: string
  payment_status?: PaymentStatus
  payment_method?: PaymentMethod
  amount_paid?: number
  deposit_amount?: number
  payment_note?: string
  paid_at?: string
  is_recurring?: boolean
  recurring_frequency?: string
  recurring_series_id?: string
  client?: Client
  pet?: Pet
}
