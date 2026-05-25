import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveEnquiry } from '../utils/enquiryStorage';

export default function IntakeForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Enquiry Name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Enquiry Description is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();

    if (Object.keys(newErrors).length === 0) {
      const result = saveEnquiry(formData);
      if (result) {
        setSubmitted(true);
        setFormData({
          name: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
        });
        setTimeout(() => {
          setSubmitted(false);
          navigate('/');
        }, 2000);
      } else {
        alert('Error saving enquiry. Please try again.');
      }
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <div className="container">
      <div className="formWrapper">
        <h2 className="heading">New Intake Enquiry</h2>

        {submitted && (
          <div className="successMessage">
            ✓ Enquiry submitted successfully! Redirecting to dashboard...
          </div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <div className="formGroup">
            <label htmlFor="name" className="label">
              Enquiry Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input ${errors.name ? 'error' : ''}`}
              placeholder="Enter enquiry name"
            />
            {errors.name && (
              <span className="errorMessage">{errors.name}</span>
            )}
          </div>

          <div className="formGroup">
            <label htmlFor="description" className="label">
              Enquiry Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`textarea ${errors.description ? 'error' : ''}`}
              placeholder="Enter detailed description"
              rows="5"
            />
            {errors.description && (
              <span className="errorMessage">{errors.description}</span>
            )}
          </div>

          <div className="formGroup">
            <label htmlFor="date" className="label">
              Date *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`input ${errors.date ? 'error' : ''}`}
            />
            {errors.date && (
              <span className="errorMessage">{errors.date}</span>
            )}
          </div>

          <div className="formGroup">
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="textarea"
              placeholder="Add any additional notes"
              rows="3"
            />
          </div>

          <div className="buttonGroup">
            <button type="submit" className="submitBtn">
              Submit Enquiry
            </button>
            <button
              type="button"
              className="cancelBtn"
              onClick={() => navigate('/')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
