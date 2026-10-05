import { Capacitor } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform?.() || false;

export const publicAppBaseUrl = () => {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL
    || import.meta.env.VITE_APP_BASE_URL
    || import.meta.env.VITE_API_BASE_URL
    || (typeof window !== 'undefined' ? window.location.origin : '');
  return String(configured).replace(/\/api\/?$/i, '').replace(/\/$/, '');
};

export const inviteUrl = code => `${publicAppBaseUrl()}/invite/${encodeURIComponent(code)}`;

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const fileNameFromUrl = (url, fallback = 'my-ajo-evidence') => {
  const clean = String(url || '').split('?')[0].split('#')[0];
  const name = decodeURIComponent(clean.slice(clean.lastIndexOf('/') + 1) || fallback);
  return name.includes('.') ? name : `${name}.pdf`;
};

export async function copyText(value) {
  const text = String(value || '');
  if (isNativeApp()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
    return;
  }
  if (!navigator.clipboard) throw new Error('Copy is not available on this device.');
  await navigator.clipboard.writeText(text);
}

export async function shareText({ title = 'My Ajo', text = '', url = '' }) {
  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: title });
    return;
  }
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return;
  }
  await copyText(url || text);
}

export async function openExternalUrl(url) {
  const value = String(url || '');
  if (!value) return;
  if (isNativeApp()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: value });
    return;
  }
  window.open(value, '_blank', 'noopener,noreferrer');
}

export async function saveUrlToDevice(url, fileName) {
  const value = String(url || '');
  if (!value) throw new Error('No file to save.');
  const name = fileName || fileNameFromUrl(value);

  if (isNativeApp()) {
    const response = await fetch(value, { credentials: 'include' });
    if (!response.ok) throw new Error('Could not download evidence file.');
    const blob = await response.blob();
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path: name,
      data: await blobToBase64(blob),
      directory: Directory.Documents,
      recursive: true,
    });
    return name;
  }

  const link = document.createElement('a');
  link.href = value;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return name;
}

export async function fetchPrivateFile(url, fallbackName = 'my-ajo-evidence') {
  const value = String(url || '');
  if (!value) throw new Error('No file to open.');
  const response = await fetch(value, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not open evidence file.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  const contentType = String(blob.type || response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = ({
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  })[contentType];
  return {
    blob,
    contentType,
    fileName: encodedName ? decodeURIComponent(encodedName) : quotedName || (extension ? `${fallbackName}.${extension}` : fileNameFromUrl(value, fallbackName)),
  };
}

export async function saveBlobToDevice(blob, fileName) {
  if (!blob) throw new Error('No file to save.');
  const name = fileName || 'my-ajo-evidence';
  if (isNativeApp()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Documents, recursive: true });
    return name;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export async function saveOrShareBlob({ blob, fileName, title = 'My Ajo', text = '' }) {
  if (isNativeApp()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const result = await Filesystem.writeFile({
      path: fileName,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title,
      text,
      url: result.uri,
      dialogTitle: title,
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
