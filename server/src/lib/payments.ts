import crypto from 'node:crypto';
import { config } from '../config';
import { HttpError } from './http';
import { safeEq } from './auth';

export interface PaymentProvider {
  name: 'mock' | 'razorpay';
  createOrder(o: { amountPaise: number; receipt: string }): Promise<{ providerOrderId: string; checkout: Record<string, unknown> }>;
  verifyPayment(o: { providerOrderId: string; paymentId: string; signature: string }): boolean;
  refund(o: { paymentId: string; amountPaise: number; key: string }): Promise<{ refundId: string }>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
}

const hmac = (secret: string, data: string | Buffer) => crypto.createHmac('sha256', secret).update(data).digest('hex');

/** Test and local development only. No money moves. Blocked in production by config. */
export const mockSign = (providerOrderId: string, paymentId: string) => hmac('mock-secret', `${providerOrderId}|${paymentId}`);
export const mockWebhookSign = (raw: string | Buffer) => hmac('mock-webhook-secret', raw);

const mock: PaymentProvider = {
  name: 'mock',
  async createOrder({ amountPaise }) {
    const id = 'mock_order_' + crypto.randomUUID();
    // Dev only: lets the mobile app complete a fake payment without knowing the secret.
    const paymentId = 'pay_mock_' + crypto.randomBytes(5).toString('hex');
    return { providerOrderId: id, checkout: { mock: true, amountPaise, currency: 'INR', paymentId, signature: mockSign(id, paymentId) } };
  },
  verifyPayment: ({ providerOrderId, paymentId, signature }) => safeEq(mockSign(providerOrderId, paymentId), signature),
  async refund() {
    return { refundId: 'mock_rfnd_' + crypto.randomUUID() };
  },
  verifyWebhook: (raw, sig) => safeEq(mockWebhookSign(raw), sig),
};

function razorpay(): PaymentProvider {
  const keyId = config.RAZORPAY_KEY_ID!;
  const secret = config.RAZORPAY_KEY_SECRET!;
  const auth = 'Basic ' + Buffer.from(`${keyId}:${secret}`).toString('base64');
  const call = async (path: string, body: unknown) => {
    const r = await fetch('https://api.razorpay.com/v1' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify(body),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', j?.error?.description || 'Payment provider error');
    return j;
  };
  return {
    name: 'razorpay',
    async createOrder({ amountPaise, receipt }) {
      const j = await call('/orders', { amount: amountPaise, currency: 'INR', receipt });
      return { providerOrderId: j.id, checkout: { keyId, orderId: j.id, amountPaise, currency: 'INR' } };
    },
    // Razorpay checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    verifyPayment: ({ providerOrderId, paymentId, signature }) => safeEq(hmac(secret, `${providerOrderId}|${paymentId}`), signature),
    async refund({ paymentId, amountPaise, key }) {
      const j = await call(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, speed: 'normal', receipt: key });
      return { refundId: j.id };
    },
    // Webhook signature: HMAC_SHA256(raw_body, webhook_secret)
    verifyWebhook: (raw, sig) => safeEq(hmac(config.RAZORPAY_WEBHOOK_SECRET!, raw), sig),
  };
}

export const provider: PaymentProvider = config.PAYMENT_PROVIDER === 'razorpay' ? razorpay() : mock;
