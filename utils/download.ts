import { bigIntReplacer } from '../store/logic/utils';

export const downloadText = (filename: string, text: string, mime = 'text/plain') => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadJson = (filename: string, data: any) => {
  const text = JSON.stringify(data, bigIntReplacer, 2);
  downloadText(filename, text, 'application/json');
};

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const copyJsonToClipboard = async (data: any) => {
  const text = JSON.stringify(data, bigIntReplacer, 2);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
};
