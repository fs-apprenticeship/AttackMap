import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import './globals.css'
import { cn } from "@/lib/utils"
import { HeaderAuth } from "@/components/header-auth"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AttackMap',
  description: 'AI-powered network scan visualization and security analysis',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" className={cn("font-sans", inter.variable)}>
        <body
          className={`${geistSans.variable} ${geistMono.variable} bg-zinc-100 antialiased`}
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
        >
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:px-6">
            <Link href="/" className="flex items-center gap-3 rounded-md transition-opacity hover:opacity-80">
              <div className="flex size-9 items-center justify-center rounded-md bg-zinc-950 text-white">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-5 text-zinc-950">AttackMap</p>
                <p className="hidden text-xs text-zinc-500 sm:block">
                  Network scan intelligence
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <HeaderAuth />
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
