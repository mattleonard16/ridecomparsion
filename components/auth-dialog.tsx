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
      <div className="glass-card-strong rounded-2xl p-8 shadow-2xl border-2 border-green-500/30">
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white">Check your email</h3>
            <p className="text-gray-300">
              We sent a magic link to <strong className="text-white">{email}</strong>. Click the
              link to sign in.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-300 border border-white/20"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card-strong rounded-2xl p-8 shadow-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3 text-center">
          <h3 className="text-2xl font-bold text-white">Sign in to save routes</h3>
          <p className="text-gray-400">Enter your email to receive a magic link</p>
        </div>

        <div className="space-y-3">
          <label htmlFor="email" className="text-sm font-medium text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white/10 transition-all duration-300 outline-none"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/50"
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-300 border border-white/20"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
