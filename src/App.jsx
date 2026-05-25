import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import IntakeForm from './components/IntakeForm';
import './App.css';

export default function EnquiryManagementSystem() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleMenu = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <Router>
      <div className="app">
        <Header toggleMenu={toggleMenu} menuOpen={sidebarOpen} />
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        <main className="mainContent">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/intake" element={<IntakeForm />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
