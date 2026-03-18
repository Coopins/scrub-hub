'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar, Users, LayoutDashboard, LogOut, Menu, Scissors, Settings, UserCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile',   label: 'Profile',   icon: UserCircle },
  { href: '/calendar',  label: 'Calendar',  icon: Calendar },
  { href: '/clients',   label: 'Clients',   icon: Users },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Overlay for mobile sidebar (Sign Out access) */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — visible at md+ always, mobile slide-in for Sign Out */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-30 flex flex-col transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Scrub Hub</h1>
              <p className="text-slate-500 text-xs">Grooming Software</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}>
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar — shown below md, hamburger opens sidebar for Sign Out */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-emerald-600 p-1.5 rounded-md">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">Scrub Hub</span>
          </Link>
          {/* Hamburger opens sidebar for Sign Out access */}
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-slate-400">
            <Menu className="w-5 h-5" />
          </Button>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav clearance */}
        <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Tab Bar — hidden at md+ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 safe-area-inset-bottom">
        <div className="flex h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  active ? 'text-emerald-400' : 'text-slate-500 active:text-slate-300'
                )}
              >
                <Icon className={cn('w-5 h-5', active ? 'text-emerald-400' : 'text-slate-500')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
