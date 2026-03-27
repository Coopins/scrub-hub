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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error('Please enter your email address first.')
      return
    }
    setResetSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password reset link sent — check your email.')
    }
    setResetSending(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md bg-slate-800 border-slate-700 text-white">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <span className="text-4xl">🐾</span>
        </div>
        <CardTitle className="text-2xl font-bold text-white">Scrub Hub</CardTitle>
        <CardDescription className="text-slate-400">Sign in to your grooming dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetSending}
              className="text-xs text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
            >
              {resetSending ? 'Sending…' : 'Forgot your password?'}
            </button>
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center">
        <p className="text-slate-400 text-sm w-full">
          Don't have an account?{' '}
          <Link href="/signup" className="text-emerald-400 hover:underline">Sign up</Link>
        </p>
      </CardFooter>
    </Card>
  )
}
