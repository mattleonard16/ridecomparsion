import { notFound } from 'next/navigation'

// Block access to test pages in production
export default function TestLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <>{children}</>
}
