export const dynamic = 'force-dynamic'

import MobileShell from '@/components/MobileShell'
import CheckInModal from '@/components/CheckInModal'
import SessionGuard from '@/components/SessionGuard'
import SessionKeepAlive from '@/components/SessionKeepAlive'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <MobileShell>{children}</MobileShell>
      <CheckInModal />
      <SessionGuard />
      <SessionKeepAlive />
    </>
  )
}
