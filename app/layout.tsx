import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/app-shell/theme-provider"
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
