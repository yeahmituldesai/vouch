export type Checkout = { mock?: boolean; paymentId?: string; signature?: string; keyId?: string; orderId?: string; amountPaise: number };

/**
 * Collects the payment and returns what the server needs to verify it.
 * - mock (development): the server hands back a fake payment, no money moves.
 * - razorpay (production): opens Razorpay Checkout. Needs `npx expo install react-native-razorpay`
 *   and a development or production build (it does not run in Expo Go).
 */
export async function collectPayment(c: Checkout, desc: string): Promise<{ paymentId: string; signature: string }> {
  if (c.mock && c.paymentId && c.signature) return { paymentId: c.paymentId, signature: c.signature };
  let Razorpay: any;
  try {
    // @ts-ignore optional native module, installed before the first production build
    Razorpay = require('react-native-razorpay').default;
  } catch {
    throw new Error('Payments are not available in this build. Install the payments module and rebuild.');
  }
  try {
    const r = await Razorpay.open({
      key: c.keyId, order_id: c.orderId, amount: c.amountPaise, currency: 'INR', name: 'Vouch', description: desc,
      theme: { color: '#000000' }, retry: { enabled: false },
    });
    return { paymentId: r.razorpay_payment_id, signature: r.razorpay_signature };
  } catch (e: any) {
    throw new Error(e?.description || 'Payment was cancelled');
  }
}
