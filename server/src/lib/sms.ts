import { config } from '../config';
import { HttpError } from './http';

export const PHONE_LOGIN_UNAVAILABLE_MESSAGE =
  'Phone sign-in is unavailable because SMS delivery is not configured. Use Google sign-in instead.';

// Phone login only works when an SMS can actually reach the user: a real SMS
// provider in any environment, or the console provider outside production
// (where the code is shown to the developer instead of being sent).
export function phoneLoginEnabled(): boolean {
  return config.SMS_PROVIDER !== 'console' || config.NODE_ENV !== 'production';
}

export async function sendOtp(phone: string, code: string) {
  if (config.SMS_PROVIDER === 'console') {
    // Never write an OTP to production logs. The API reports phone login as
    // unavailable instead (see phoneLoginEnabled above).
    if (config.NODE_ENV === 'production')
      throw new HttpError(503, 'PHONE_LOGIN_UNAVAILABLE', PHONE_LOGIN_UNAVAILABLE_MESSAGE);
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
