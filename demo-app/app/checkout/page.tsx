import { Suspense } from 'react';
import CheckoutForm from './CheckoutForm';

export default function CheckoutPage() {
  return (
    <section>
      <h1>Checkout</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <CheckoutForm />
      </Suspense>
    </section>
  );
}
