import { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, ArrowUpRight, ArrowDownRight, Users, Building2, Contact, Package2 } from 'lucide-react';
import { getQuotes } from '../utils/quoteStorage';
import { getSalesLeads } from '../utils/salesLeadStorage';
import { getAccounts } from '../utils/accountStorage';
import { getContacts } from '../utils/contactStorage';
import { getProducts } from '../utils/productStorage';
import { useAuth } from '../context/AuthContext';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const statusStyles = {
  Pending: 'bg-amber-200 text-amber-800',
  Sent: 'bg-blue-200 text-blue-800',
  Accepted: 'bg-emerald-200 text-emerald-800',
  Rejected: 'bg-red-200 text-red-800',
};

export default function RevenueDashboard() {
  const { isAdmin } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [salesLeads, setSalesLeads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    loadDashboardData();
  }, [isAdmin]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [quotesResult, leadsResult, accountsResult, contactsResult, productsResult] = await Promise.allSettled([
        getQuotes(),
        getSalesLeads(),
        getAccounts(),
        getContacts(),
        getProducts(),
      ]);

      setQuotes(quotesResult.status === 'fulfilled' ? quotesResult.value : []);
      setSalesLeads(leadsResult.status === 'fulfilled' ? leadsResult.value : []);
      setAccounts(accountsResult.status === 'fulfilled' ? accountsResult.value : []);
      setContacts(contactsResult.status === 'fulfilled' ? contactsResult.value : []);
      setProducts(productsResult.status === 'fulfilled' ? productsResult.value : []);

      if ([quotesResult, leadsResult, accountsResult, contactsResult, productsResult].some((result) => result.status === 'rejected')) {
        setError('Some dashboard data could not be loaded');
      }
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
      setQuotes([]);
      setSalesLeads([]);
      setAccounts([]);
      setContacts([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const getRecordDate = (item) => {
    const candidates = ['createdDate', 'createdAt', 'created', 'startDate', 'receivedDate', 'updatedDate'];
    for (const key of candidates) {
      const value = item?.[key];
      if (!value) continue;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  };

  const getQuoteCreatedDate = (quote) => {
    if (quote?.createdAt) return new Date(quote.createdAt);
    if (quote?.quotation?.quotationDate) return new Date(quote.quotation.quotationDate);
    return null;
  };

  const filterByDateRange = (items) => {
    if (!startDate && !endDate) return items;

    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return items.filter((item) => {
      const createdDate = getRecordDate(item);
      if (!createdDate) return false;
      if (start && createdDate < start) return false;
      if (end && createdDate > end) return false;
      return true;
    });
  };

  const filteredQuotes = useMemo(() => {
    if (!startDate && !endDate) return quotes;

    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return quotes.filter((quote) => {
      const createdDate = getQuoteCreatedDate(quote);
      if (!createdDate) return false;
      if (start && createdDate < start) return false;
      if (end && createdDate > end) return false;
      return true;
    });
  }, [quotes, startDate, endDate]);

  const filteredLeads = useMemo(() => filterByDateRange(salesLeads), [salesLeads, startDate, endDate]);
  const filteredAccounts = useMemo(() => filterByDateRange(accounts), [accounts, startDate, endDate]);
  const filteredContacts = useMemo(() => filterByDateRange(contacts), [contacts, startDate, endDate]);
  const filteredProducts = useMemo(() => filterByDateRange(products), [products, startDate, endDate]);

  const counts = useMemo(() => ({
    leads: filteredLeads.length,
    accounts: filteredAccounts.length,
    contacts: filteredContacts.length,
    products: filteredProducts.length,
  }), [filteredLeads, filteredAccounts, filteredContacts, filteredProducts]);

  const leadStats = useMemo(() => {
    const statusCounts = filteredLeads.reduce((acc, lead) => {
      const status = lead.leadStatus || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const regionCounts = filteredLeads.reduce((acc, lead) => {
      const region = lead.leadRegion || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {});

    const sourceCounts = filteredLeads.reduce((acc, lead) => {
      const source = lead.leadSource || 'Unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    const productTypeCounts = filteredLeads.reduce((acc, lead) => {
      const productType = lead.productType || 'Unknown';
      acc[productType] = (acc[productType] || 0) + 1;
      return acc;
    }, {});

    const dealAmounts = filteredLeads
      .map((lead) => Number(lead.targetDealAmount) || 0)
      .filter((amount) => amount > 0);

    const totalDealAmount = dealAmounts.reduce((sum, amount) => sum + amount, 0);
    const averageDealAmount = dealAmounts.length ? totalDealAmount / dealAmounts.length : 0;
    const highestDealAmount = dealAmounts.length ? Math.max(...dealAmounts) : 0;

    return {
      statusCounts,
      regionCounts,
      sourceCounts,
      productTypeCounts,
      totalDealAmount,
      averageDealAmount,
      highestDealAmount,
      dealAmountCount: dealAmounts.length,
    };
  }, [filteredLeads]);

  const stats = useMemo(() => {
    const revenueByStatus = {
      Pending: 0,
      Sent: 0,
      Accepted: 0,
      Rejected: 0,
    };
    const countsByStatus = {
      Pending: 0,
      Sent: 0,
      Accepted: 0,
      Rejected: 0,
    };
    let totalRevenue = 0;

    const list = filteredQuotes.map((quote) => {
      const amount = Number(quote?.totals?.grandTotal) || 0;
      const status = quote?.status || 'Pending';
      if (!revenueByStatus[status]) {
        revenueByStatus[status] = 0;
        countsByStatus[status] = 0;
      }
      revenueByStatus[status] += amount;
      countsByStatus[status] += 1;
      totalRevenue += amount;
      return { ...quote, amount };
    });

    const acceptedPercent = totalRevenue ? Math.round((revenueByStatus.Accepted / totalRevenue) * 100) : 0;
    const pendingPercent = totalRevenue ? Math.round((revenueByStatus.Pending / totalRevenue) * 100) : 0;
    const sentPercent = totalRevenue ? Math.round((revenueByStatus.Sent / totalRevenue) * 100) : 0;
    const rejectedPercent = totalRevenue ? Math.round((revenueByStatus.Rejected / totalRevenue) * 100) : 0;

    const topQuotes = [...list]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((quote) => ({
        id: quote.id,
        label: quote.quotation?.quoteNumber || quote.id,
        customer: quote.customer?.customerName || 'Unknown',
        amount: currencyFormatter.format(quote.amount),
        status: quote.status || 'Pending',
      }));

    return {
      revenueByStatus,
      countsByStatus,
      totalRevenue,
      acceptedPercent,
      sentPercent,
      pendingPercent,
      rejectedPercent,
      quoteCount: filteredQuotes.length,
      averageRevenue: filteredQuotes.length ? totalRevenue / filteredQuotes.length : 0,
      topQuotes,
    };
  }, [filteredQuotes]);

  const statusBars = [
    { label: 'Accepted', value: stats.revenueByStatus.Accepted, color: 'bg-emerald-500' },
    { label: 'Sent', value: stats.revenueByStatus.Sent, color: 'bg-blue-500' },
    { label: 'Pending', value: stats.revenueByStatus.Pending, color: 'bg-amber-500' },
    { label: 'Rejected', value: stats.revenueByStatus.Rejected, color: 'bg-red-500' },
  ];

  if (!isAdmin) {
    return (
      <div className="min-h-full bg-surface px-5 py-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Revenue Dashboard</h2>
          <p className="mt-4 text-sm text-slate-600">
            Access restricted to admin users only.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface">
        <Loader2 className="size-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface px-5 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
              <TrendingUp className="size-4" />
              Revenue Analytics
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Sales Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Monitor and analyze sales performance, revenue trends, and key metrics across leads, accounts, contacts, and products.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/10"
              />
            </div>
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="rounded-3xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Executive Summary</p>
            <div className="mt-3 flex items-end gap-6">
              <div>
                <p className="text-3xl font-semibold text-slate-900">{currencyFormatter.format(stats.totalRevenue)}</p>
                <p className="text-sm text-slate-500">Total Quotation Revenue</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-slate-900">{stats.quoteCount}</p>
                <p className="text-sm text-slate-500">Quotations</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'New Leads', value: counts.leads, icon: Users, accent: 'text-sky-700 bg-sky-50' },
            { label: 'New Accounts', value: counts.accounts, icon: Building2, accent: 'text-emerald-700 bg-emerald-50' },
            { label: 'New Contacts', value: counts.contacts, icon: Contact, accent: 'text-violet-700 bg-violet-50' },
            { label: 'New Products', value: counts.products, icon: Package2, accent: 'text-amber-700 bg-amber-50' },
          ].map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className={`inline-flex rounded-2xl p-3 ${tile.accent}`}>
                  <Icon className="size-5" />
                </div>
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{tile.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{tile.value}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500"><b>Lead</b> Insights</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
              <div className="mt-3 space-y-2">
                {Object.entries(leadStats.statusCounts).slice(0, 4).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sales Region</p>
              <div className="mt-3 space-y-2">
                {Object.entries(leadStats.regionCounts).slice(0, 4).map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{region}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deal Amount</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{currencyFormatter.format(leadStats.totalDealAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Average</span>
                  <span className="font-semibold">{currencyFormatter.format(leadStats.averageDealAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Highest</span>
                  <span className="font-semibold">{currencyFormatter.format(leadStats.highestDealAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Leads with amount</span>
                  <span className="font-semibold">{leadStats.dealAmountCount}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lead Source</p>
              <div className="mt-3 space-y-2">
                {Object.entries(leadStats.sourceCounts).slice(0, 4).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{source}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Product Type</p>
              <div className="mt-3 space-y-2">
                {Object.entries(leadStats.productTypeCounts).slice(0, 4).map(([productType, count]) => (
                  <div key={productType} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{productType}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="grid gap-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Revenue by Status
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {currencyFormatter.format(stats.totalRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  Avg per quote
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {currencyFormatter.format(stats.averageRevenue)}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {statusBars.map((status) => {
                  const percent = stats.totalRevenue ? Math.round((status.value / stats.totalRevenue) * 100) : 0;
                  return (
                    <div key={status.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                        <span>{status.label}</span>
                        <span>{currencyFormatter.format(status.value)}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200">
                        <div
                          className={`${status.color} h-3 rounded-full transition-all duration-300`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Accepted Revenue</p>
                <p className="mt-4 text-3xl font-semibold text-emerald-700">
                  {currencyFormatter.format(stats.revenueByStatus.Accepted)}
                </p>
                <p className="mt-2 text-sm text-slate-500">{stats.acceptedPercent}% of total revenue</p>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Pending Revenue</p>
                <p className="mt-4 text-3xl font-semibold text-amber-700">
                  {currencyFormatter.format(stats.revenueByStatus.Pending)}
                </p>
                <p className="mt-2 text-sm text-slate-500">{stats.pendingPercent}% of total revenue</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Revenue Tiles</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">Sales momentum across statuses</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <ArrowUpRight className="size-3" /> Live
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {['Sent', 'Rejected'].map((status) => (
                  <div key={status} className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{status} Revenue</p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">
                      {currencyFormatter.format(stats.revenueByStatus[status])}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {stats.countsByStatus[status] || 0} quotations
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Revenue Distribution</p>
              <div className="mt-6 space-y-4">
                {Object.entries(stats.revenueByStatus).map(([status, value]) => {
                  const percent = stats.totalRevenue ? Math.round((value / stats.totalRevenue) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-4">
                      <div className={`h-3 flex-1 rounded-full ${statusStyles[status]}`} />
                      <div className="min-w-[4.5rem] text-right text-sm font-semibold text-slate-700">
                        {percent}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {Object.entries(stats.countsByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm text-slate-700">
                    <span>{status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Top Opportunities</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">Highest quote values</p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {stats.topQuotes.length === 0 ? (
                  <p className="text-sm text-slate-500">No quotations available yet.</p>
                ) : (
                  stats.topQuotes.map((quote) => (
                    <div key={quote.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">{quote.label}</p>
                          <p className="text-sm text-slate-500">{quote.customer}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{quote.amount}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
