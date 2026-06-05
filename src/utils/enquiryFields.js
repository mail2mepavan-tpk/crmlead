export function getCustomerName(enquiry) {
  return enquiry?.customerName || enquiry?.name || '';
}

export function enquiryMatchesSearch(enquiry, term) {
  const q = term.toLowerCase();
  const haystack = [
    enquiry.enquiryNo,
    getCustomerName(enquiry),
    enquiry.salesPoc,
    enquiry.region,
    enquiry.contactPerson,
    enquiry.contactMobile,
    enquiry.contactEmail,
    enquiry.description,
    enquiry.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function formatEnquiryDetails(enquiry) {
  return [
    `Enquiry No: ${enquiry.enquiryNo || '—'}`,
    `Customer: ${getCustomerName(enquiry)}`,
    `Sales POC: ${enquiry.salesPoc || '—'}`,
    `Region: ${enquiry.region || '—'}`,
    `Contact: ${enquiry.contactPerson || '—'}`,
    `Mobile: ${enquiry.contactMobile || '—'}`,
    `Email: ${enquiry.contactEmail || '—'}`,
    `Date: ${enquiry.date || '—'}`,
    enquiry.description ? `Description: ${enquiry.description}` : null,
    enquiry.notes ? `Notes: ${enquiry.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
