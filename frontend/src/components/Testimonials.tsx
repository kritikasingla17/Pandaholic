interface Testimonial {
  name: string;
  city: string;
  product: string;
  rating: number;
  text: string;
}

// Placeholder content: replace with real customer feedback before launch.
const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Aisha K.',
    city: 'Ludhiana',
    product: 'Personalized Photo Frame',
    rating: 5,
    text: 'The frame looked even better than the preview. It arrived well packed and my sister loved it!',
  },
  {
    name: 'Rohan S.',
    city: 'Chandigarh',
    product: 'Custom Poster',
    rating: 5,
    text: 'Colours are vibrant and the matte finish is lovely. Great quality for the price.',
  },
  {
    name: 'Simran B.',
    city: 'Amritsar',
    product: 'Spotify Love Card',
    rating: 5,
    text: 'Made it for our anniversary and it got a proper emotional reaction. Such a thoughtful gift.',
  },
  {
    name: 'Karan M.',
    city: 'Jalandhar',
    product: 'Polaroid Prints',
    rating: 4,
    text: 'Sharp prints and quick delivery. Will order more for the whole trip album.',
  },
];

function initials(name: string): string {
  return name
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function Stars({ value }: { value: number }) {
  return (
    <span className="testimonial__stars" role="img" aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(value)}
      <span className="testimonial__stars-off">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export default function Testimonials() {
  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <header className="testimonials__header">
        <span className="testimonials__eyebrow">Happy gifting</span>
        <h2 id="testimonials-title">Loved by our customers</h2>
        <p className="testimonials__subtitle">Little words that make our day 💌</p>
      </header>

      <div className="testimonials__grid" tabIndex={0} aria-label="Customer testimonials">
        {TESTIMONIALS.map((t, i) => (
          <figure className={`testimonial testimonial--tone-${i % 4}`} key={t.name}>
            <span className="testimonial__quote-mark" aria-hidden="true">
              “
            </span>
            <Stars value={t.rating} />
            <blockquote>{t.text}</blockquote>
            <span className="testimonial__chip">{t.product}</span>
            <figcaption>
              <span className="testimonial__avatar" aria-hidden="true">
                {initials(t.name)}
              </span>
              <span className="testimonial__who">
                <strong>{t.name}</strong>
                <span>{t.city}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="testimonials__swipe-hint" aria-hidden="true">
        Swipe to read more →
      </p>
    </section>
  );
}