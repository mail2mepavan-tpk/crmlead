import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';
import IntakeForm from './components/IntakeForm';
import AccountsDashboard from './components/AccountsDashboard';
import AccountForm from './components/AccountForm';
import ContactsDashboard from './components/ContactsDashboard';
import ContactForm from './components/ContactForm';
import UsersDashboard from './components/UsersDashboard';
import UserForm from './components/UserForm';
import SalesRegionsDashboard from './components/SalesRegionsDashboard';
import SalesRegionForm from './components/SalesRegionForm';
import LeadSourcesDashboard from './components/LeadSourcesDashboard';
import LeadSourceForm from './components/LeadSourceForm';
import EmailGroupsDashboard from './components/EmailGroupsDashboard';
import EmailGroupForm from './components/EmailGroupForm';
import SalesLeadsDashboard from './components/SalesLeadsDashboard';
import SalesLeadForm from './components/SalesLeadForm';
import DealsDashboard from './components/DealsDashboard';
import DealForm from './components/DealForm';
import LoginPage from './components/LoginPage';
import {
  PublicRoute,
  ProtectedRoute,
  AdminRoute,
} from './components/RouteGuards';

export default function EnquiryManagementSystem() {
  return (
    <Router>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/intake" element={<IntakeForm />} />
            <Route path="/intake/:id" element={<IntakeForm />} />
            <Route path="/accounts" element={<AccountsDashboard />} />
            <Route path="/accounts/new" element={<AccountForm />} />
            <Route path="/accounts/:id/edit" element={<AccountForm />} />
            <Route path="/contacts" element={<ContactsDashboard />} />
            <Route path="/contacts/new" element={<ContactForm />} />
            <Route path="/contacts/:id/edit" element={<ContactForm />} />
            <Route path="/sales-leads" element={<SalesLeadsDashboard />} />
            <Route path="/sales-leads/new" element={<SalesLeadForm />} />
            <Route path="/sales-leads/:id/edit" element={<SalesLeadForm />} />
            <Route path="/deals" element={<DealsDashboard />} />
            <Route path="/deals/new" element={<DealForm />} />
            <Route path="/deals/:id/edit" element={<DealForm />} />
            <Route path="/profile" element={<UserForm />} />

            <Route element={<AdminRoute />}>
              <Route path="/users" element={<UsersDashboard />} />
              <Route path="/users/new" element={<UserForm />} />
              <Route path="/users/:id/edit" element={<UserForm />} />
              <Route path="/sales-regions" element={<SalesRegionsDashboard />} />
              <Route path="/sales-regions/new" element={<SalesRegionForm />} />
              <Route path="/sales-regions/:id/edit" element={<SalesRegionForm />} />
              <Route path="/lead-sources" element={<LeadSourcesDashboard />} />
              <Route path="/lead-sources/new" element={<LeadSourceForm />} />
              <Route path="/lead-sources/:id/edit" element={<LeadSourceForm />} />
              <Route path="/email-groups" element={<EmailGroupsDashboard />} />
              <Route path="/email-groups/new" element={<EmailGroupForm />} />
              <Route path="/email-groups/:id/edit" element={<EmailGroupForm />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}
