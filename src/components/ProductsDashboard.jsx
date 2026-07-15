import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PackagePlus, Pencil, Search, Trash2, Boxes, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createProduct, deleteProduct, getProducts, getProductsSummary, updateProduct } from '../utils/productStorage';

export default function ProductsDashboard() {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getProducts();
      setProducts(Array.isArray(data) ? data : []);
      setSummary(getProductsSummary(Array.isArray(data) ? data : []));
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setProducts([]);
      setSummary({ total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const haystack = [product.productCode, product.productName, product.productDesciption, product.createdBy]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [products, searchTerm]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete product "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const getExcelValue = (row, keys) => {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return '';
  };

  const handleExportExcel = () => {
    const data = products.map((product) => ({
      productCode: product.productCode || '',
      productName: product.productName || '',
      productDesciption: product.productDesciption || '',
      unitMeasurements: product.unitMeasurements || '',
      salePrice: product.salePrice === '' || product.salePrice == null ? '' : Number(product.salePrice),
      createdBy: product.createdBy || '',
      createdDate: product.createdDate || '',
      updatedBy: product.updatedBy || '',
      updatedDate: product.updatedDate || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'products.xlsx');
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rows.length) {
        throw new Error('The selected Excel file is empty.');
      }

      const importedProducts = rows.map((row, index) => ({
        productCode: getExcelValue(row, ['productCode', 'ProductCode', 'code', 'Code']) || `AUTO-${index + 1}`,
        productName: getExcelValue(row, ['productName', 'ProductName', 'name', 'Name']) || '',
        productDesciption: getExcelValue(row, ['productDesciption', 'productDescription', 'ProductDesciption', 'description', 'Description']) || '',
        unitMeasurements: getExcelValue(row, ['unitMeasurements', 'UnitMeasurements', 'unitMeasurement', 'UnitMeasurement', 'measurement', 'Measurements']) || '',
        salePrice: getExcelValue(row, ['salePrice', 'SalePrice', 'saleprice', 'unitPrice', 'UnitPrice', 'price', 'Price']) || '',
        createdBy: getExcelValue(row, ['createdBy', 'CreatedBy']) || 'System',
        createdDate: getExcelValue(row, ['createdDate', 'CreatedDate']) || new Date().toISOString(),
        updatedBy: getExcelValue(row, ['updatedBy', 'UpdatedBy']) || 'System',
        updatedDate: getExcelValue(row, ['updatedDate', 'UpdatedDate']) || new Date().toISOString(),
      }));

      for (const product of importedProducts) {
        await createProduct(product);
      }

      await loadProducts();
      alert(`${importedProducts.length} product(s) imported successfully.`);
    } catch (err) {
      alert(err.message || 'Failed to import Excel file');
    } finally {
      event.target.value = '';
    }
  };

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Products</h2>
            <p className="mt-1 text-sm text-slate-500">Manage product catalog entries with full CRUD support.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50">
              <Upload className="size-4" />
              Import Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
            <button type="button" onClick={handleExportExcel} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700">
              <Download className="size-4" />
              Export Excel
            </button>
            <Link to="/products/new" className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline transition-all hover:bg-sky-600">
              <PackagePlus className="size-4" />
              New Product
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-1">
          <div className="flex items-center gap-4 rounded-lg bg-white p-5 shadow-sm">
            <Boxes className="size-10 shrink-0 text-brand" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Products</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{summary.total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by code, name, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-800 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {filteredProducts.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <PackagePlus className="mx-auto mb-5 size-16 text-slate-400" />
              <p className="mb-5 text-slate-500">{products.length === 0 ? 'No products yet. Create the first one.' : 'No products match your search.'}</p>
              {products.length === 0 && (
                <Link to="/products/new" className="inline-block rounded bg-sky-500 px-5 py-2.5 font-semibold text-white no-underline hover:bg-sky-600">
                  Add First Product
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-surface text-left uppercase text-[11px] tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">Code</th>
                    <th className="px-4 py-4">Name</th>
                    <th className="px-4 py-4">Description</th>
                    <th className="px-4 py-4">Unit Measurements</th>
                    <th className="px-4 py-4">Sale Price</th>
                    <th className="px-4 py-4">Created By</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold text-slate-900">{product.productCode || '—'}</td>
                      <td className="px-4 py-4 text-slate-700">{product.productName || '—'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.productDesciption || '—'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.unitMeasurements || '—'}</td>
                      <td className="px-4 py-4 text-slate-600">{product.salePrice === '' || product.salePrice == null ? '—' : `₹${Number(product.salePrice).toLocaleString('en-IN')}`}</td>
                      <td className="px-4 py-4 text-slate-600">{product.createdBy || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Link to={`/products/${product.id}/edit`} className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50" title="Edit product">
                            <Pencil className="size-4" />
                          </Link>
                          <button type="button" onClick={() => handleDelete(product.id, product.productName || product.productCode || 'product')} className="rounded border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50" title="Delete product">
                            <Trash2 className="size-4" />
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
      </div>
    </div>
  );
}
