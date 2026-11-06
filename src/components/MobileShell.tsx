'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] bg-[#FAFAFA]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {/* En celular deja espacio para la barra inferior (+ zona segura del iPhone) */}
        <main className="flex-1 overflow-auto overscroll-contain px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-6 lg:pb-6">
          {children}
        </main>
      </div>

      <BottomNav onMas={() => setSidebarOpen(o => !o)} menuAbierto={sidebarOpen} />
    </div>
  )
}
