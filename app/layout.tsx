import type { Metadata } from 'next'
// Clerk is deferred for now. Re-enable this import with the provider and auth
// controls below when authentication is back in scope.
// import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Geist, Geist_Mono, Inter } from 'next/font/google'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import './globals.css'
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-zinc-100 antialiased`}>
        {/* <ClerkProvider> */}
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
          {/*
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton>
                <button className="h-9 rounded-md border bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800">
                  Sign up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
          */}
        </header>
        {children}
        {/* </ClerkProvider> */}
      </body>
    </html>
  )
}
