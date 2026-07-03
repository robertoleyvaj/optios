export const dynamic = 'force-dynamic'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CheckInModal from '@/components/CheckInModal'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-[#FAFAFA]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto px-6 py-6">
          {children}
        </main>
      </div>
      <CheckInModal />
    </div>
  )
}
