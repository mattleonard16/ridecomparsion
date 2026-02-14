'use client'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)
}

export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const mounted = useIsMounted()

  if (!mounted) return null

  return createPortal(children, document.body)
}
