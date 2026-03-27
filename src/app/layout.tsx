import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Scrub Hub | Professional Grooming Software',
  description: 'Built by groomers, for groomers.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-slate-950 min-h-screen">
      <body className={`${inter.className} bg-slate-950 min-h-screen`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
