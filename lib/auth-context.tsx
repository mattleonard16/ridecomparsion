'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession as useNextAuthSession } from 'next-auth/react'
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'
import type { Session } from 'next-auth'

interface AuthContextType {
  user: { id: string; email?: string; name?: string; image?: string } | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useNextAuthSession()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'loading') {
      setLoading(false)
    }
  }, [status])

  const signIn = async (email: string, password: string) => {
    const result = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      return { error: new Error(result.error) }
    }

    return { error: null }
  }

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false })
  }

  const user = session?.user
    ? {
        id: session.user.id || '',
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        image: session.user.image || undefined,
      }
    : null

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
