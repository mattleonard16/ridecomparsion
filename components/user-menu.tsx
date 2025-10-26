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
      <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user.email}
        </span>
        <Button onClick={signOut} variant="outline" size="sm">
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button onClick={() => setShowAuth(true)} variant="outline" size="sm">
        Sign in
      </Button>
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md">
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

