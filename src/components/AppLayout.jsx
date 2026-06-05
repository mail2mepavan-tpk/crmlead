import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen flex-col bg-surface text-slate-700">
      <Header
        toggleMenu={() => setSidebarOpen((open) => !open)}
        menuOpen={sidebarOpen}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main
        className={[
          'flex-1 overflow-y-auto transition-[margin-left] duration-300 ease-in-out',
          sidebarOpen ? 'md:ml-64' : 'ml-0',
        ].join(' ')}
      >
        <Outlet />
      </main>
    </div>
  );
}
