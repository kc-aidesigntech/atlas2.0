import type { ReactNode } from 'react'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

interface WorkspaceFrameProps {
  navigation: ReactNode
  children: ReactNode
}

// The frame owns only global workspace chrome. Feature panels stay independent
// so changing overlay or role-routing behavior cannot accidentally alter the shell.
export default function WorkspaceFrame({ navigation, children }: WorkspaceFrameProps) {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white"
      style={{
        backgroundColor: SP_COLORS.bg,
        color: SP_COLORS.text,
        fontFamily: 'Helvetica, Arial, sans-serif'
      }}
    >
      {navigation}
      <main className="atlas-shell-edge-buffer relative py-[10px]">{children}</main>
    </div>
  )
}
