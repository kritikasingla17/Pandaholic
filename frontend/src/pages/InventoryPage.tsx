import { useMemo, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

export default function InventoryPage() {
  const { products, loading } = useCatalog();
  const { getAvailable, setStock, adjustStock } = useStore();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .flatMap((product) =>
        product.variants.map((variant) => ({ product, variant }))
      )
      .filter(({ product, variant }) => {
        if (!query) return true;
        const optionText = variant.options.map((o) => o.value).join(' ').toLowerCase();
        return (
          product.title.toLowerCase().includes(query) ||
          variant.sku.toLowerCase().includes(query) ||
          optionText.includes(query)
        );
      });
  }, [products, search]);

  if (loading) return <div className="state-message">Loading inventory…</div>;

  return (
    <div className="inventory-page">
      <h1>Inventory Management</h1>
      <input
        className="search-input"
        type="search"
        placeholder="Search by product, SKU or option…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Option</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ product, variant }) => {
              const stock = getAvailable(variant.id, variant.available);
              return (
                <tr key={variant.id}>
                  <td>
                    <div className="inventory-table__product">
                      {product.image && <img src={product.image} alt="" />}
                      <span>{product.title}</span>
                    </div>
                  </td>
                  <td>{variant.options.map((o) => `${o.name}: ${o.value}`).join(', ') || '—'}</td>
                  <td>{variant.sku || '—'}</td>
                  <td>{formatCurrency(variant.price)}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="stock-input"
                      value={stock}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setStock(variant.id, Number.isFinite(val) ? val : 0);
                      }}
                    />
                  </td>
                  <td>
                    <div className="qty-stepper">
                      <button onClick={() => adjustStock(variant.id, -1)} disabled={stock <= 0}>
                        −
                      </button>
                      <button onClick={() => adjustStock(variant.id, 1)}>+</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
