import { useState } from 'react';
import type { Product, ProductVariant } from '../types';
import { deleteProduct, deleteVariant, saveProduct, saveVariant } from '../data/adminCatalog';
import { formatOptionsText, parseOptionsText } from '../utils/format';
import { CATEGORY_OPTIONS } from '../constants/categories';

interface EditorProps {
  product: Product;
  onChanged: () => void;
}

export default function InventoryProductEditor({ product, onChanged }: EditorProps) {
  const [title, setTitle] = useState(product.title);
  const [category, setCategory] = useState(product.category);
  const [description, setDescription] = useState(product.description);
  const [image, setImage] = useState(product.image);
  const [status, setStatus] = useState(product.status);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Include the product's current category even if it's not one of the 5
  // curated options (e.g. legacy/auto-derived data), so saving never
  // silently changes it to something the admin didn't pick.
  const categoryOptions = CATEGORY_OPTIONS.includes(product.category)
    ? CATEGORY_OPTIONS
    : [product.category, ...CATEGORY_OPTIONS];

  async function handleSaveProduct() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProduct(
        {
          title,
          description,
          category,
          tags: product.tags,
          image,
          images: product.images,
          optionNames: product.optionNames,
          personalizable: product.personalizable,
          status,
        },
        product.id
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    if (!window.confirm(`Delete "${product.title}" and all its variants? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProduct(product.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      setSaving(false);
    }
  }

  async function handleAddVariant() {
    setSaving(true);
    setError(null);
    try {
      await saveVariant(product.id, {
        sku: '',
        options: [],
        price: 0,
        compareAtPrice: null,
        available: 0,
        image: null,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add variant');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inventory-product">
      <div className="inventory-product__header">
        {product.image ? (
          <img src={product.image} alt="" className="inventory-product__thumb" />
        ) : (
          <div className="inventory-product__thumb inventory-product__thumb--empty" />
        )}
        <div className="inventory-product__fields">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="inventory-product__actions">
          <button onClick={handleSaveProduct} disabled={saving}>
            Save
          </button>
          <button onClick={handleDeleteProduct} disabled={saving} className="danger">
            Delete
          </button>
          <button onClick={() => setExpanded((v) => !v)} type="button">
            {expanded ? 'Hide details' : 'More'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="inventory-product__details">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
          />
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Image URL" />
        </div>
      )}

      {error && <p className="inventory-product__error">{error}</p>}

      <table className="inventory-table">
        <thead>
          <tr>
            <th>Options</th>
            <th>SKU</th>
            <th>Price</th>
            <th>Compare at</th>
            <th>Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((variant) => (
            <VariantRow key={variant.id} productId={product.id} variant={variant} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
      <button onClick={handleAddVariant} disabled={saving} className="inventory-product__add-variant" type="button">
        + Add variant
      </button>
    </div>
  );
}

function VariantRow({
  productId,
  variant,
  onChanged,
}: {
  productId: string;
  variant: ProductVariant;
  onChanged: () => void;
}) {
  const [optionsText, setOptionsText] = useState(formatOptionsText(variant.options));
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(variant.price);
  const [compareAt, setCompareAt] = useState<number | ''>(variant.compareAtPrice ?? '');
  const [available, setAvailable] = useState(variant.available);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveVariant(
        productId,
        {
          sku,
          options: parseOptionsText(optionsText),
          price: Number(price) || 0,
          compareAtPrice: compareAt === '' ? null : Number(compareAt),
          available: Math.max(0, Number(available) || 0),
          image: variant.image,
        },
        variant.id
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save variant');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this variant?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteVariant(variant.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variant');
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>
        <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Name: Value" />
      </td>
      <td>
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="stock-input"
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={compareAt}
          onChange={(e) => setCompareAt(e.target.value === '' ? '' : Number(e.target.value))}
          className="stock-input"
        />
      </td>
      <td>
        <input
          type="number"
          min={0}
          value={available}
          onChange={(e) => setAvailable(Number(e.target.value))}
          className="stock-input"
        />
      </td>
      <td>
        <div className="inventory-product__actions">
          <button onClick={handleSave} disabled={saving}>
            Save
          </button>
          <button onClick={handleDelete} disabled={saving} className="danger">
            Delete
          </button>
        </div>
        {error && <p className="inventory-product__error">{error}</p>}
      </td>
    </tr>
  );
}
