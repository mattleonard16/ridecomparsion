'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { AuthDialog } from '@/components/auth-dialog'

export function UserMenu() {
  const { user, signOut, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  if (loading) {
    return (
      <div className="h-10 w-24 animate-shimmer rounded-xl glass-card" />
    )
  }

  if (user) {
    return (
      <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-3 hover-glow">
        <span className="text-sm text-gray-300 hidden sm:inline font-medium">
          {user.email}
        </span>
        <button
          onClick={signOut}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all duration-300 border border-white/10"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowAuth(true)}
        className="glass-card px-5 py-2.5 rounded-xl text-white font-medium hover-glow transition-all duration-300 border border-white/20"
      >
        Sign in
      </button>
      {showAuth && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-end bg-black/80 backdrop-blur-sm p-4" 
          style={{ 
            zIndex: 99999,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: 'translateZ(0)'
          }}
        >
          <div className="w-full max-w-md mr-8">
            <AuthDialog
              onClose={() => setShowAuth(false)}
              onSuccess={() => setShowAuth(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

