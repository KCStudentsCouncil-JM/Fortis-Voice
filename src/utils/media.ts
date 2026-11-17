import type { MediaAttachment } from '@/src/types/civic';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;

export const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB raw file limit
export const MAX_GIF_STORED_BYTES = 450 * 1024; // 450 KB raw (~600 KB base64) for animated GIFs
export const MAX_VIDEO_BYTES = 500 * 1024; // 500 KB raw (~670 KB base64) inline limit; larger videos should use external URL
export const MAX_AVATAR_DATA_URL_LENGTH = 180_000; // Matches Firestore 200,000 char avatarDataUrl rule

export interface MediaProcessResult {
  ok: true;
  attachment: MediaAttachment;
}

export interface MediaProcessError {
  ok: false;
  error: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function compressImageViaCanvas(
  dataUrl: string,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable for image compression.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // Use WebP when supported, fallback to JPEG
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp')) {
        resolve(webp);
      } else {
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
    };
    img.onerror = () => reject(new Error('Selected file could not be decoded as an image.'));
    img.src = dataUrl;
  });
}

export async function processMediaFile(
  file: File,
  caption?: string
): Promise<MediaProcessResult | MediaProcessError> {
  const id = `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      return {
        ok: false,
        error: `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Allowed formats: JPEG, PNG, WebP, or GIF up to 8 MB.`,
      };
    }
    try {
      const rawUrl = await readFileAsDataUrl(file);
      if (file.type === 'image/gif') {
        if (file.size > MAX_GIF_STORED_BYTES) {
          return {
            ok: false,
            error: 'Animated GIFs must be 450 KB or smaller to stay within document storage limits. Try JPEG, PNG, or WebP for automatic compression.',
          };
        }
        return {
          ok: true,
          attachment: { id, type: 'image', url: rawUrl, caption: caption?.trim() || file.name },
        };
      }
      let compressed = await compressImageViaCanvas(rawUrl, 1100, 0.76);
      if (compressed.length > 260_000) {
        compressed = await compressImageViaCanvas(rawUrl, 850, 0.65);
      }
      return {
        ok: true,
        attachment: { id, type: 'image', url: compressed, caption: caption?.trim() || file.name },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to process image file.',
      };
    }
  }

  if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) {
      return {
        ok: false,
        error: `Direct video uploads are capped at 500 KB (${(file.size / (1024 * 1024)).toFixed(1)} MB selected) so petitions save reliably. Paste an external hosted video link below instead.`,
      };
    }
    try {
      const url = await readFileAsDataUrl(file);
      return {
        ok: true,
        attachment: { id, type: 'video', url, caption: caption?.trim() || file.name },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to read video file.',
      };
    }
  }

  return {
    ok: false,
    error: `Unsupported file type (${file.type || 'unknown'}). Upload JPEG, PNG, WebP, or GIF images, or short MP4/WebM clips.`,
  };
}

export async function compressAvatarFile(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.type === 'image/gif') {
    return {
      ok: false,
      error: 'Please choose a JPEG, PNG, or WebP image for your profile avatar.',
    };
  }
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    return {
      ok: false,
      error: 'Avatar image must be smaller than 8 MB before compression.',
    };
  }
  try {
    const raw = await readFileAsDataUrl(file);
    let compressed = await compressImageViaCanvas(raw, 256, 0.78);
    if (compressed.length > MAX_AVATAR_DATA_URL_LENGTH) {
      compressed = await compressImageViaCanvas(raw, 192, 0.62);
    }
    if (compressed.length > MAX_AVATAR_DATA_URL_LENGTH) {
      return {
        ok: false,
        error: 'Compressed avatar is still too large. Please try a simpler or smaller photo.',
      };
    }
    return { ok: true, dataUrl: compressed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not process avatar image.',
    };
  }
}

export function validateExternalVideoUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a valid https:// video URL.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'Video link must start with https:// or http://.' };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'Please enter a valid video URL (e.g. https://vimeo.com/... or https://youtu.be/...).' };
  }
}
