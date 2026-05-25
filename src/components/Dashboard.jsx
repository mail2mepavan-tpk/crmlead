import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getEnquiries,
  deleteEnquiry,
  exportEnquiries,
  importEnquiries,
  getEnquiriesSummary,
} from '../utils/enquiryStorage';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, today: 0, thisMonth: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    loadEnquiries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [enquiries, searchTerm, filterDate, sortBy]);

  const loadEnquiries = () => {
    const data = getEnquiries();
    setEnquiries(data);
    setSummary(getEnquiriesSummary());
  };

  const applyFilters = () => {
    let filtered = [...enquiries];

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterDate) {
      filtered = filtered.filter((e) => e.date === filterDate);
    }

    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setFilteredEnquiries(filtered);
  };

  const handleDelete = (id) => {
    if (
      window.confirm(
        'Are you sure you want to delete this enquiry? This action cannot be undone.'
      )
    ) {
      deleteEnquiry(id);
      loadEnquiries();
    }
  };

  const handleExport = () => {
    exportEnquiries();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      importEnquiries(file)
        .then(() => {
          alert('Enquiries imported successfully!');
          loadEnquiries();
        })
        .catch((error) => {
          alert('Error importing enquiries: ' + error.message);
        });
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="dashContainer">
      <div className="dashInner">
        {/* Summary Cards */}
        <div className="summaryCards">
          <div className="card">
            <div className="cardIcon">📊</div>
            <div className="cardContent">
              <p className="cardLabel">Total Enquiries</p>
              <p className="cardValue">{summary.total}</p>
            </div>
          </div>

          <div className="card">
            <div className="cardIcon">📅</div>
            <div className="cardContent">
              <p className="cardLabel">Today</p>
              <p className="cardValue">{summary.today}</p>
            </div>
          </div>

          <div className="card">
            <div className="cardIcon">📈</div>
            <div className="cardContent">
              <p className="cardLabel">This Month</p>
              <p className="cardValue">{summary.thisMonth}</p>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="controlsSection">
          <div className="searchGroup">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="searchInput"
            />
          </div>

          <div className="filterGroup">
            <label>Filter by Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="filterInput"
            />
          </div>

          <div className="sortGroup">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sortSelect"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">By Name (A-Z)</option>
            </select>
          </div>

          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="clearBtn"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="actionButtons">
          <Link to="/intake" className="newBtn">
            + New Enquiry
          </Link>
          <button onClick={handleExport} className="exportBtn">
            📥 Export
          </button>
          <label className="importBtn">
            📤 Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
            />
          </label>
        </div>

        {/* Enquiries List/Table */}
        <div className="enquiriesList">
          {filteredEnquiries.length === 0 ? (
            <div className="emptyState">
              <p className="emptyIcon">📭</p>
              <p className="emptyText">
                {enquiries.length === 0
                  ? 'No enquiries yet. Create your first enquiry!'
                  : 'No enquiries match your filters.'}
              </p>
              {enquiries.length === 0 && (
                <Link to="/intake" className="createLink">
                  Create New Enquiry
                </Link>
              )}
            </div>
          ) : (
            <div className="tableWrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      <td className="nameCell">{enquiry.name}</td>
                      <td className="descCell">
                        {enquiry.description.substring(0, 50)}
                        {enquiry.description.length > 50 ? '...' : ''}
                      </td>
                      <td>{formatDate(enquiry.date)}</td>
                      <td className="notesCell">
                        {enquiry.notes
                          ? enquiry.notes.substring(0, 30) + '...'
                          : '-'}
                      </td>
                      <td>
                        <div className="actionCell">
                          <button
                            className="viewBtn"
                            title="View Details"
                            onClick={() => alert(enquiry.description)}
                          >
                            👁️
                          </button>
                          <button
                            className="deleteBtn"
                            title="Delete"
                            onClick={() => handleDelete(enquiry.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results Count */}
        {filteredEnquiries.length > 0 && (
          <div className="resultsInfo">
            Showing {filteredEnquiries.length} of {enquiries.length} enquiries
          </div>
        )}
      </div>
    </div>
  );
}
