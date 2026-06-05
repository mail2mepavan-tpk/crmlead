import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function SidebarToggle({ open, onClick }) {
  return (
    <button
      type="button"
      className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800/60 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700/80 hover:text-white"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? 'Close sidebar' : 'Open sidebar'}
    >
      <PanelLeftOpen
        className={[
          'absolute size-5 transition-all duration-300 ease-in-out',
          open ? '-translate-x-5 opacity-0' : 'translate-x-0 opacity-100',
        ].join(' ')}
        aria-hidden={open}
      />
      <PanelLeftClose
        className={[
          'absolute size-5 transition-all duration-300 ease-in-out',
          open ? 'translate-x-0 opacity-100' : 'translate-x-5 opacity-0',
        ].join(' ')}
        aria-hidden={!open}
      />
    </button>
  );
}
