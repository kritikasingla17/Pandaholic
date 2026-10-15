import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Product, ProductVariant, Personalization } from '../types';
import { useStore } from '../context/StoreContext';
import { preparePersonalizationPhoto } from '../lib/photos';
import { formatCurrency, formatDescription } from '../utils/format';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

// The original file can be large (phone photos); it's shrunk before it goes into the cart.
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const DESCRIPTION_HEADINGS = new Set(['Product Description', 'Specifications']);
const DESCRIPTION_LABEL_LINE = /^([A-Z][a-zA-Z]*(?:\s[A-Za-z]+){0,2}:)\s(.*)$/;

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
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [added, setAdded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const selectedVariant: ProductVariant | undefined = useMemo(
    () => product.variants.find((v) => v.id === variantId),
    [product.variants, variantId]
  );

  const descriptionLines = useMemo(() => formatDescription(product.description), [product.description]);

  const available = selectedVariant ? getAvailable(selectedVariant.id, selectedVariant.available) : 0;

  // Posters (and any other product with a single option axis, e.g. just
  // "Size") get a clearer pick-a-size chip UI instead of a generic dropdown.
  const singleOptionName = product.optionNames.length === 1 ? product.optionNames[0] : null;

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus trap: move focus into the modal on open, return it on close
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the close button (first focusable element)
    const closeBtn = modal.querySelector<HTMLElement>('.modal-close');
    closeBtn?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function clearPhoto() {
    setPhotoDataUrl(null);
    setPhotoName(null);
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setPhotoError(null);
    if (!file) return;

    clearPhoto();
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('This photo is too large. Please choose one under 25 MB.');
      return;
    }

    setPhotoProcessing(true);

    try {
      setPhotoDataUrl(await preparePersonalizationPhoto(file));
      setPhotoName(file.name);
    } catch (err: unknown) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : "We couldn't use this photo. Please try another one."
      );
    } finally {
      setPhotoProcessing(false);
    }
  }

  const handleAddToCart = useCallback(() => {
    if (!selectedVariant || available <= 0 || photoProcessing) return;
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
  }, [selectedVariant, available, photoProcessing, recipientName, message, instructions, photoDataUrl, photoName, addToCart, product, quantity]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal__content">
          <div className="modal__image">
            {product.image ? (
              <img src={product.image} alt={product.title} decoding="async" fetchPriority="high" />
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
            {descriptionLines.length > 0 && (
              <div className="modal__description">
                {descriptionLines.map((line, i) => {
                  if (DESCRIPTION_HEADINGS.has(line)) {
                    return (
                      <p key={i} className="modal__description-heading">
                        {line}
                      </p>
                    );
                  }
                  const labelMatch = line.match(DESCRIPTION_LABEL_LINE);
                  return (
                    <p key={i} className="modal__description-line">
                      {labelMatch ? (
                        <>
                          <strong>{labelMatch[1]}</strong> {labelMatch[2]}
                        </>
                      ) : (
                        line
                      )}
                    </p>
                  );
                })}
              </div>
            )}

            {product.variants.length > 1 &&
              (singleOptionName ? (
                <div className="field">
                  <span>{singleOptionName.toLowerCase() === 'size' ? 'Choose print size' : `Choose ${singleOptionName}`}</span>
                  <div className="size-option-group">
                    {product.variants.map((v) => {
                      const stock = getAvailable(v.id, v.available);
                      const value = v.options[0]?.value || 'Default';
                      const outOfStock = stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={
                            'size-option' +
                            (v.id === variantId ? ' size-option--selected' : '') +
                            (outOfStock ? ' size-option--disabled' : '')
                          }
                          onClick={() => setVariantId(v.id)}
                          disabled={outOfStock}
                        >
                          {value}
                          {outOfStock && <span className="size-option__note"> (out of stock)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
              ))}

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
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                  disabled={quantity >= available}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </label>

            {product.personalizable && (
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
                  <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoProcessing} />
                </label>
                {photoProcessing && <p className="photo-preview">Preparing photo…</p>}
                {photoError && <p className="field-error">{photoError}</p>}
                {photoDataUrl && (
                  <div className="photo-preview">
                    <img src={photoDataUrl} alt={photoName ?? 'preview'} />
                    <span>{photoName}</span>
                    <button type="button" className="btn btn--link" onClick={clearPhoto}>
                      Remove
                    </button>
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
            )}

            <button
              className="btn btn--primary"
              onClick={handleAddToCart}
              disabled={available <= 0 || photoProcessing}
            >
              {added ? 'Added to cart ✓' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
