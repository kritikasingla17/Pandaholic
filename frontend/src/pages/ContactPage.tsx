export default function ContactPage() {
  return (
    <div className="contact-page">
      <section className="contact-hero">
        <h1>We're Here to Help</h1>
        <p>
          Have a question about your order, a custom piece, or personalization options? Reach out
          via email anytime. Follow us on Instagram to stay updated on new designs, restocks and
          offers.
        </p>
      </section>

      <div className="contact-page__cards">
        <div className="contact-card">
          <span className="contact-card__icon contact-card__icon--email" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" fill="none" />
              <path d="M4 4h16v16H4V4z" />
              <path d="M4 6l8 7 8-7" />
            </svg>
          </span>
          <strong>Customer Support</strong>
          <p>Questions about your order, personalization or a custom panda piece? Drop us an email — we're just a message away.</p>
          <a className="contact-card__btn" href="mailto:pandaholicdiy@gmail.com">
            Email Us
          </a>
        </div>

        <div className="contact-card">
          <span className="contact-card__icon contact-card__icon--instagram" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <strong>Follow on Instagram</strong>
          <p>New designs, restocks, behind-the-scenes and customer favorites — all on our page.</p>
          <a
            className="contact-card__btn"
            href="https://www.instagram.com/pandaholicdiy"
            target="_blank"
            rel="noopener noreferrer"
          >
            @pandaholicdiy
          </a>
        </div>
      </div>
    </div>
  );
}
