import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  Users,
  UserPlus,
  Megaphone,
  Building2,
  PhoneCall,
  MapPin,
  Tag,
  Mail,
  Briefcase,
  FileText,
  ArrowUpRight,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }) =>
  [
    'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium no-underline transition-all',
    isActive
      ? 'border-l-[3px] border-brand bg-nav-active pl-[9px] text-nav-active-text shadow-sm'
      : 'border-l-[3px] border-transparent pl-[9px] text-slate-600 hover:bg-nav-hover hover:text-slate-900',
  ].join(' ');

const iconClass = (isActive) =>
  isActive ? 'text-brand' : 'text-nav-muted group-hover:text-slate-600';

function NavItem({ to, end, onClose, icon: Icon, label }) {
  return (
    <NavLink to={to} end={end} className={navLinkClass} onClick={onClose}>
      {({ isActive }) => (
        <>
          <Icon className={`size-[18px] shrink-0 ${iconClass(isActive)}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mt-4 mb-2 px-3 text-[10px] font-bold tracking-[0.12em] text-nav-muted uppercase">
      {children}
    </p>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin } = useAuth();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 top-16 z-[39] bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed top-16 z-40 flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-nav-border bg-nav shadow-sm',
          'transition-[left] duration-300 ease-in-out',
          isOpen ? 'left-0' : '-left-64',
        ].join(' ')}
      >
        <div className="border-b border-nav-border bg-linear-to-r from-slate-50 to-white px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-accent/10">
              <Megaphone className="size-4 text-accent" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Navigation</p>
              <p className="text-[10px] text-nav-muted">Sales pipeline tools</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <SectionLabel>Sales</SectionLabel>
          <div className="flex flex-col gap-0.5">
            <NavItem
              to="/sales-leads"
              end
              onClose={onClose}
              icon={LayoutDashboard}
              label="Leads Dashboard"
            />
            <NavItem
              to="/deals"
              onClose={onClose}
              icon={Briefcase}
              label="Opportunities"
            />
            <NavItem
              to="/accounts"
              onClose={onClose}
              icon={Building2}
              label="Accounts"
            />
            <NavItem
              to="/products"
              onClose={onClose}
              icon={Package}
              label="Products"
            />
            <NavItem
              to="/contacts"
              onClose={onClose}
              icon={PhoneCall}
              label="Contacts"
            />
          </div>

          {isAdmin && (
            <>
              <SectionLabel>Administration</SectionLabel>
              <div className="flex flex-col gap-0.5">
                <NavItem
                  to="/users"
                  onClose={onClose}
                  icon={Users}
                  label="Users"
                />
                <NavItem
                  to="/sales-regions"
                  onClose={onClose}
                  icon={MapPin}
                  label="Sales Regions"
                />
                <NavItem
                  to="/lead-sources"
                  onClose={onClose}
                  icon={Tag}
                  label="Lead Sources"
                />
                <NavItem
                  to="/email-groups"
                  onClose={onClose}
                  icon={Mail}
                  label="Email Groups"
                />
                <NavItem
                  to="/quotations"
                  onClose={onClose}
                  icon={FileText}
                  label="Quotations"
                />
                <NavItem
                  to="/revenue"
                  onClose={onClose}
                  icon={ArrowUpRight}
                  label="Revenue Dashboard"
                />
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-nav-border bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-medium text-nav-muted">
            SalesHub Enterprise
          </p>
          <p className="text-[10px] text-slate-400">v1.0 · Marketing CRM</p>
        </div>
      </aside>
    </>
  );
}
