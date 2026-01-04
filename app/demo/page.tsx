'use client'

import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar'

/**

 * Demo file - Default export is required

 * This is what users and moderators see in preview

 */

export default function Demo() {
  return (
    <div
      style={{
        background: '#ffffff',

        minHeight: '100vh',

        display: 'flex',

        alignItems: 'center',

        justifyContent: 'center',
      }}
    >
      <PillBase />
    </div>
  )
}
