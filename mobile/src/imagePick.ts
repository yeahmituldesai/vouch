import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type ImageSpec = { width: number; height: number; maxBytes: number; label: string };

// Same rules X/Twitter publishes for profile images:
// profile photo 400x400 / 2 MB, header 1500x500 / 5 MB, static JPG/PNG/GIF.
export const AVATAR_SPEC: ImageSpec = { width: 400, height: 400, maxBytes: 2 * 1024 * 1024, label: 'Profile photo' };
export const BANNER_SPEC: ImageSpec = { width: 1500, height: 500, maxBytes: 5 * 1024 * 1024, label: 'Header photo' };
export const IDEA_SPEC: ImageSpec = { width: 1600, height: 1600, maxBytes: 5 * 1024 * 1024, label: 'Photo' };

export const mbLabel = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

// Picks an image, crops it to the aspect ratio and resizes it before upload so the
// app sends a small, predictable JPEG instead of a multi-megabyte camera photo.
export async function pickImage(spec: ImageSpec, aspect: [number, number]): Promise<{ dataUrl: string; bytes: number } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo permission is required');

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  const uri = picked.canceled ? undefined : picked.assets?.[0]?.uri;
  if (!uri) return null;

  const out = await manipulateAsync(
    uri,
    [{ resize: { width: spec.width, height: spec.height } }],
    { compress: 0.85, format: SaveFormat.JPEG, base64: true },
  );
  const b64 = out.base64 ?? '';
  if (!b64) throw new Error('Could not read that image');
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > spec.maxBytes) throw new Error(`${spec.label} must be under ${mbLabel(spec.maxBytes)}`);
  return { dataUrl: `data:image/jpeg;base64,${b64}`, bytes };
}
