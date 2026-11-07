import { config } from '../config';
import { HttpError } from './http';

export async function sendOtp(phone: string, code: string) {
  if (config.SMS_PROVIDER === 'console') {
    console.log(`[sms:console] OTP for ${phone}: ${code}`);
    return;
  }
  // MSG91 OTP API. Verify the exact request shape against your MSG91 dashboard before launch.
  const url =
    'https://control.msg91.com/api/v5/otp' +
    `?template_id=${encodeURIComponent(config.MSG91_TEMPLATE_ID!)}` +
    `&mobile=${encodeURIComponent(phone.replace('+', ''))}&otp=${code}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authkey: config.MSG91_AUTH_KEY!, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new HttpError(502, 'SMS_FAILED', 'Could not send the code. Try again.');
}
