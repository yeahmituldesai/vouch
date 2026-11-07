import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { config } from '../config';

export function imagesEnabled(): boolean {
  return !!(config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY && config.R2_SECRET_KEY && config.R2_BUCKET && config.R2_PUBLIC_URL);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.R2_ACCESS_KEY!, secretAccessKey: config.R2_SECRET_KEY! },
  });
  return client;
}

// Accepts a data URL (data:image/...;base64,...) or raw base64. Returns the public URL.
export async function uploadImage(dataUrl: string, prefix: string): Promise<string> {
  if (!imagesEnabled()) throw new Error('Image uploads are not configured');
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mime = m ? m[1] : 'image/jpeg';
  const b64 = m ? m[2] : dataUrl;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new Error('Image must be under 5MB');
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const key = `${prefix}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
  await getClient().send(new PutObjectCommand({ Bucket: config.R2_BUCKET, Key: key, Body: buf, ContentType: mime }));
  return `${config.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}