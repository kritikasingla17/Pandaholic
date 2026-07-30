import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import InventoryProductEditor from '../components/InventoryProductEditor';
import { fetchAllProductsForAdmin, saveProduct, saveVariant } from '../data/adminCatalog';
import { useCatalog } from '../context/CatalogContext';
import { CATEGORY_OPTIONS } from '../constants/categories';
import type { Product } from '../types';

const EMPTY_NEW_PRODUCT = {
  title: '',
  category: 'Other',
  description: '',
  image: '',
  sku: '',
  price: '',
  compareAtPrice: '',
  available: '',
};

export default function InventoryPage() {
  const { refresh: refreshPublicCatalog } = useCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState(EMPTY_NEW_PRODUCT);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAllProductsForAdmin();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any admin change should also refresh the public-facing catalog so the
  // storefront doesn't show stale data for the rest of the current session.
  const handleChanged = useCallback(() => {
    refresh();
    refreshPublicCatalog();
  }, [refresh, refreshPublicCatalog]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => {
      const skuMatch = p.variants.some((v) => v.sku.toLowerCase().includes(query));
      return (
        p.title.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        skuMatch
      );
    });
  }, [products, search]);

  function updateNewProduct(field: keyof typeof EMPTY_NEW_PRODUCT, value: string) {
    setNewProduct((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateProduct(e: FormEvent) {
    e.preventDefault();
    if (!newProduct.title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const productId = await saveProduct({
        title: newProduct.title.trim(),
        description: newProduct.description.trim(),
        category: newProduct.category.trim() || 'Other',
        tags: [],
        image: newProduct.image.trim(),
        images: newProduct.image.trim() ? [newProduct.image.trim()] : [],
        optionNames: [],
        personalizable: true,
        status: 'active',
      });

      // Create the product's first variant too, so price/stock/SKU are set
      // immediately instead of requiring a separate "+ Add variant" step.
      await saveVariant(productId, {
        sku: newProduct.sku.trim(),
        options: [],
        price: Number(newProduct.price) || 0,
        compareAtPrice: newProduct.compareAtPrice === '' ? null : Number(newProduct.compareAtPrice),
        available: Math.max(0, Number(newProduct.available) || 0),
        image: newProduct.image.trim() || null,
      });

      setNewProduct(EMPTY_NEW_PRODUCT);
      setShowAddForm(false);
      handleChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="state-message">Loading inventory…</div>;

  return (
    <div className="inventory-page">
      <div className="inventory-page__header">
        <h1>Inventory Management</h1>
        <button type="button" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Cancel' : '+ Add product'}
        </button>
      </div>

      {error && <div className="state-message state-message--error">{error}</div>}

      {showAddForm && (
        <form className="inventory-add-form" onSubmit={handleCreateProduct}>
          <input
            value={newProduct.title}
            onChange={(e) => updateNewProduct('title', e.target.value)}
            placeholder="Product title"
            required
          />
          <select value={newProduct.category} onChange={(e) => updateNewProduct('category', e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={newProduct.image}
            onChange={(e) => updateNewProduct('image', e.target.value)}
            placeholder="Image URL"
          />
          <input
            value={newProduct.sku}
            onChange={(e) => updateNewProduct('sku', e.target.value)}
            placeholder="SKU"
          />
          <input
            type="number"
            min={0}
            value={newProduct.price}
            onChange={(e) => updateNewProduct('price', e.target.value)}
            placeholder="Price"
            required
          />
          <input
            type="number"
            min={0}
            value={newProduct.compareAtPrice}
            onChange={(e) => updateNewProduct('compareAtPrice', e.target.value)}
            placeholder="Compare-at price (optional)"
          />
          <input
            type="number"
            min={0}
            value={newProduct.available}
            onChange={(e) => updateNewProduct('available', e.target.value)}
            placeholder="Stock"
          />
          <textarea
            value={newProduct.description}
            onChange={(e) => updateNewProduct('description', e.target.value)}
            placeholder="Description"
            rows={2}
          />
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      <input
        className="search-input"
        type="search"
        placeholder="Search by product, category or SKU…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="inventory-product-list">
        {filtered.length === 0 ? (
          <div className="state-message">No products found.</div>
        ) : (
          filtered.map((product) => (
            <InventoryProductEditor key={product.id} product={product} onChanged={handleChanged} />
          ))
        )}
      </div>
    </div>
  );
}

