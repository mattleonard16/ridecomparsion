'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AuthDialogProps {
  onClose?: () => void
  onSuccess?: () => void
}

export function AuthDialog({ onClose, onSuccess }: AuthDialogProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signIn(email)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
      setTimeout(() => {
        onSuccess?.()
        onClose?.()
      }, 3000)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-lg">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
            </p>
          </div>
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sign in to save routes</h3>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a magic link
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Sending...' : 'Send magic link'}
          </Button>
          {onClose && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

