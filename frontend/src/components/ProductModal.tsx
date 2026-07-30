import { useMemo, useState } from 'react';
import type { Product, ProductVariant, Personalization } from '../types';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/format';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const { getAvailable, addToCart } = useStore();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const selectedVariant: ProductVariant | undefined = useMemo(
    () => product.variants.find((v) => v.id === variantId),
    [product.variants, variantId]
  );

  const available = selectedVariant ? getAvailable(selectedVariant.id, selectedVariant.available) : 0;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoError(null);
    if (!file) {
      setPhotoDataUrl(null);
      setPhotoName(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please upload an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Image must be smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleAddToCart() {
    if (!selectedVariant || available <= 0) return;
    const personalization: Personalization = {
      recipientName: recipientName.trim(),
      message: message.trim(),
      instructions: instructions.trim(),
      photoDataUrl,
      photoName,
    };
    addToCart({
      productHandle: product.handle,
      productTitle: product.title,
      image: product.image,
      variant: selectedVariant,
      quantity,
      personalization,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    setQuantity(1);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal__content">
          <div className="modal__image">
            {product.image ? (
              <img src={product.image} alt={product.title} />
            ) : (
              <div className="product-card__placeholder">No image</div>
            )}
          </div>
          <div className="modal__details">
            <span className="product-card__category">{product.category}</span>
            <h2>{product.title}</h2>
            <p className="modal__price">
              {selectedVariant ? formatCurrency(selectedVariant.price) : ''}
            </p>
            <p className="modal__description">{product.description}</p>

            {product.variants.length > 1 && (
              <label className="field">
                <span>Choose option</span>
                <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                  {product.variants.map((v) => {
                    const stock = getAvailable(v.id, v.available);
                    const label = v.options.map((o) => `${o.name}: ${o.value}`).join(', ') || 'Default';
                    return (
                      <option key={v.id} value={v.id} disabled={stock <= 0}>
                        {label} — {formatCurrency(v.price)} {stock <= 0 ? '(out of stock)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            <p className={available > 0 ? 'stock-note' : 'stock-note stock-note--out'}>
              {available > 0 ? `${available} in stock` : 'Out of stock'}
            </p>

            <label className="field">
              <span>Quantity</span>
              <div className="qty-stepper">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  disabled={quantity >= available}
                >
                  +
                </button>
              </div>
            </label>

            <fieldset className="personalize-panel">
              <legend>Personalize this order</legend>
              <label className="field">
                <span>Recipient / Name on product</span>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. For Aisha"
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>Custom text / message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Text you want printed / engraved / written"
                  maxLength={500}
                  rows={3}
                />
              </label>
              <label className="field">
                <span>Reference photo (optional)</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>
              {photoError && <p className="field-error">{photoError}</p>}
              {photoDataUrl && (
                <div className="photo-preview">
                  <img src={photoDataUrl} alt={photoName ?? 'preview'} />
                  <span>{photoName}</span>
                </div>
              )}
              <label className="field">
                <span>Special instructions (optional)</span>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Colors, fonts, delivery notes, etc."
                  maxLength={500}
                  rows={2}
                />
              </label>
            </fieldset>

            <button className="btn btn--primary" onClick={handleAddToCart} disabled={available <= 0}>
              {added ? 'Added to cart ✓' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
