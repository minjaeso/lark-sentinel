import Link from 'next/link';

const PRODUCTS = [
  { id: 'sku-1', name: 'Lark Hat', price: 29 },
  { id: 'sku-2', name: 'Lark Mug', price: 14 },
  { id: 'sku-3', name: 'Lark Sticker', price: 4 },
];

export default function ProductsPage() {
  return (
    <section>
      <h1>Products</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {PRODUCTS.map((p) => (
          <li
            key={p.id}
            style={{
              padding: 12,
              border: '1px solid #eee',
              borderRadius: 8,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>{p.name}</strong> — ${p.price}
            </span>
            <Link
              href={`/checkout?sku=${p.id}`}
              style={{
                padding: '6px 12px',
                background: '#111',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
              }}
              data-testid={`buy-${p.id}`}
            >
              Buy
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
