import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { config } from '../config';
import { HttpError } from './http';

// Mirrors X/Twitter's published profile rules:
//   profile photo 400x400, max 2 MB
//   header/banner 1500x500, max 5 MB
//   formats: JPG, PNG, GIF (static; animated GIFs are not used for profile images)
// plus a 5 MB cap for idea photos.
export const IMAGE_LIMITS = {
  avatar: { maxBytes: 2 * 1024 * 1024, width: 400, height: 400 },
  banner: { maxBytes: 5 * 1024 * 1024, width: 1500, height: 500 },
  idea: { maxBytes: 5 * 1024 * 1024, width: 1600, height: 1600 },
} as const;

export type ImageKind = keyof typeof IMAGE_LIMITS;

// Largest JSON body accepted for an upload. Base64 adds ~33% and the data URL prefix.
export const UPLOAD_BODY_LIMIT = '7mb';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString('latin1');
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export function imagesEnabled(): boolean {
  // Storage is always available: Cloudflare R2 when configured, otherwise the
  // (already compressed) image is stored in the database as a data URL so the
  // beta works without a third-party account.
  return true;
}

export function r2Enabled(): boolean {
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
export async function uploadImage(dataUrl: string, prefix: string, kind: ImageKind = 'idea'): Promise<string> {
  if (!imagesEnabled()) throw new Error('Image uploads are not configured');
  const limit = IMAGE_LIMITS[kind];
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!m) throw new HttpError(400, 'INVALID_IMAGE', 'Image must be a base64 data URL');
  const mime = m[1].toLowerCase();
  if (!MIME_EXT[mime]) throw new HttpError(415, 'UNSUPPORTED_IMAGE', 'Use a JPEG, PNG, GIF or WebP image');
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length) throw new HttpError(400, 'INVALID_IMAGE', 'Image is empty');
  if (sniffMime(buf) !== mime) throw new HttpError(415, 'UNSUPPORTED_IMAGE', 'File content does not match its image type');
  if (buf.length > limit.maxBytes) {
    throw new HttpError(413, 'IMAGE_TOO_LARGE', `Image must be under ${Math.round(limit.maxBytes / (1024 * 1024))} MB`);
  }
  if (r2Enabled()) {
    const key = `${prefix}/${crypto.randomBytes(12).toString('hex')}.${MIME_EXT[mime]}`;
    await getClient().send(new PutObjectCommand({ Bucket: config.R2_BUCKET, Key: key, Body: buf, ContentType: mime }));
    return `${config.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
  }
  // No R2 configured: store the (already compressed) image inline so the beta
  // works without a third-party account. The client crops and compresses first.
  return `data:${mime};base64,${m[2].replace(/\s+/g, '')}`;
}
