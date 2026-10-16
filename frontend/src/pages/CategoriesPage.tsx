import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Link } from 'react-router-dom';
import Testimonials from '../components/Testimonials';


const VALUE_PROPS = [
  { icon: '🎨', title: 'Handmade with love', text: 'Every piece is crafted by hand, not mass produced.' },
  { icon: '💌', title: '100% personalized', text: 'Add names, photos or messages to make it truly yours.' },
  { icon: '📦', title: 'Delivered to your door', text: 'Carefully packed and shipped straight to you.' },
];

function scrollToCategories(e: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('categories');
  if (!target) return;
  e.preventDefault();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}

export default function CategoriesPage() {
  const { products, categories, loading, error } = useCatalog();
  const navigate = useNavigate();
  useDocumentTitle();

  const tiles = useMemo(() => {
    return categories.map((category) => {
      const categoryProducts = products.filter((p) => p.category === category);
      return {
        category,
        count: categoryProducts.length,
        image: categoryProducts.find((p) => p.image)?.image ?? '',
      };
    });
  }, [categories, products]);

  // Products marked "featured" in the admin lead the hero collage; other
  // in-stock products with photos fill any remaining spots.
  const collageImages = useMemo(() => {
  const candidates = products.filter((p) => p.image && p.totalAvailable > 0);
  return [...candidates.filter((p) => p.featured), ...candidates.filter((p) => !p.featured)]
    .slice(0, 4)
    .map((p) => ({ src: p.image, alt: p.title, category: p.category, handle: p.handle }));
}, [products]);

  if (loading) {
    return (
      <div className="catalog-page">
        <div className="skeleton-hero" />
        <div className="category-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <div className="skeleton-card__image" />
              <div className="skeleton-card__body">
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="state-message state-message--error">Couldn't load catalog: {error}</div>;
  }

  return (
    <div className="catalog-page">
      <section className="hero-banner">
        <div className="hero-banner__content">
          <span className="hero-banner__eyebrow">Handmade • Personalized • Made just for you</span>
          <h1>Turn your ideas into handmade keepsakes</h1>
          <p>
            From custom posters and photo cards to keepsake calendars — browse our categories and
            personalize a piece that's made just for you.
          </p>
          <a href="#categories" className="btn btn--primary hero-banner__cta" onClick={scrollToCategories}>
            Shop the collection ↓
          </a>
        </div>
        {collageImages.length > 0 && (
  <div className="hero-collage">
    {collageImages.map((img, i) => (
      <Link
        to={`/category/${encodeURIComponent(img.category)}?product=${encodeURIComponent(img.handle)}`}
        className={`hero-collage__item hero-collage__item--${i}`}
        key={img.handle}
        aria-label={`View ${img.alt}`}
      >
        <img src={img.src} alt={img.alt} loading="eager" decoding="async" />
      </Link>
    ))}
  </div>
)}
      </section>

      <div className="value-props">
        {VALUE_PROPS.map((prop) => (
          <div className="value-prop" key={prop.title}>
            <span className="value-prop__icon" aria-hidden="true">
              {prop.icon}
            </span>
            <div>
              <strong>{prop.title}</strong>
              <p>{prop.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="catalog-hero" id="categories">
        <h2>Shop by category</h2>
        <p>Every piece customisable, made just for you.</p>
      </div>

      {tiles.length === 0 ? (
        <div className="state-message">No categories found.</div>
      ) : (
        <div className="category-grid">
          {tiles.map((tile) => (
            <button
              key={tile.category}
              className="category-tile"
              onClick={() => navigate(`/category/${encodeURIComponent(tile.category)}`)}
            >
              <div className="category-tile__image">
                {tile.image ? (
                  <img src={tile.image} alt={tile.category} loading="lazy" decoding="async" />
                ) : (
                  <div className="product-card__placeholder">No image</div>
                )}
              </div>
              <div className="category-tile__body">
                <h3>{tile.category}</h3>
                <p className="category-tile__count">
                  {tile.count} {tile.count === 1 ? 'product' : 'products'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      <Testimonials />
    </div>
  );
}

