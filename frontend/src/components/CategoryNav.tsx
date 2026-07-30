interface CategoryNavProps {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}

export default function CategoryNav({ categories, active, onSelect }: CategoryNavProps) {
  return (
    <div className="category-nav">
      <button className={active === 'All' ? 'chip active' : 'chip'} onClick={() => onSelect('All')}>
        All
      </button>
      {categories.map((cat) => (
        <button key={cat} className={active === cat ? 'chip active' : 'chip'} onClick={() => onSelect(cat)}>
          {cat}
        </button>
      ))}
    </div>
  );
}
