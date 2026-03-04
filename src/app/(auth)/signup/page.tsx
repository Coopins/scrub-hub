'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { business_name: businessName } }
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Account created! Check your email to verify.')
    router.push('/login')
  }

  return (
    <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-white">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <span className="text-4xl">🐾</span>
        </div>
        <CardTitle className="text-2xl font-bold text-white">Create Your Account</CardTitle>
        <CardDescription className="text-slate-400">Start managing your grooming business</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-slate-300">Business Name</Label>
            <Input id="businessName" type="text" placeholder="Fluffy Paws Grooming" value={businessName}
              onChange={(e) => setBusinessName(e.target.value)} required
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center">
        <p className="text-slate-400 text-sm w-full">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:underline">Sign in</Link>
        </p>
      </CardFooter>
    </Card>
  )
}
