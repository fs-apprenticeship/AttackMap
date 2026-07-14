import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import './globals.css'
import { cn } from "@/lib/utils"
import { HeaderAuth } from "@/components/app-shell/header-auth"
import { ThemeProvider } from "@/components/app-shell/theme-provider"
import { ThemeToggle } from "@/components/app-shell/theme-toggle"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

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
      <html
        lang="en"
        className={cn("font-sans", inter.variable)}
        suppressHydrationWarning
      >
        <body
          className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
        >
          <ThemeProvider>
            <TooltipProvider>
            <a
              href="#main-content"
              className="fixed left-4 top-4 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform focus:translate-y-0 focus:outline-none focus:ring-3 focus:ring-ring/30"
            >
              Skip to content
            </a>
            <header className="app-header sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
              <div className="flex h-16 items-center justify-between px-4 lg:px-6">
                <Link
                  href="/"
                  aria-label="AttackMap home"
                  className="group flex min-w-0 items-center gap-3 rounded-md outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-[1.03]">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="text-sm font-semibold leading-5 text-foreground">
                      AttackMap
                    </p>
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      Network scan intelligence
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <ThemeToggle />
                  <HeaderAuth />
                </div>
              </div>
            </header>
            <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
            <Toaster position="bottom-right" />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
