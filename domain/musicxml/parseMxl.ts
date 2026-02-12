import { unzipSync } from 'fflate';

type MxlExtraction = {
  xmlText: string;
  mainPath?: string;
  fileList: string[];
};

const decodeUtf8 = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: false }).decode(bytes);

const findContainerRoot = (files: Record<string, Uint8Array>) => {
  const containerKey = Object.keys(files).find((k) => k.toLowerCase().endsWith('meta-inf/container.xml'));
  if (!containerKey) return null;
  try {
    const xml = decodeUtf8(files[containerKey]);
    const DomParserCtor =
      typeof DOMParser !== 'undefined'
        ? DOMParser
        : (() => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const xmldom = require('@xmldom/xmldom');
              return xmldom.DOMParser;
            } catch (err) {
              throw new Error('DOMParser is not available in this environment.');
            }
          })();
    const doc = new DomParserCtor().parseFromString(xml, 'application/xml');
    const rootfile = typeof (doc as any).querySelector === 'function'
      ? (doc as any).querySelector('rootfile')
      : doc.getElementsByTagName('rootfile')?.[0] ?? null;
    const fullPath = rootfile?.getAttribute('full-path') || rootfile?.getAttribute('fullpath');
    return fullPath || null;
  } catch {
    return null;
  }
};

const pickFallbackXml = (files: Record<string, Uint8Array>) => {
  const candidates = Object.keys(files)
    .filter((k) => k.toLowerCase().endsWith('.xml') || k.toLowerCase().endsWith('.musicxml'))
    .map((k) => ({ key: k, size: files[k]?.byteLength ?? 0 }));
  candidates.sort((a, b) => b.size - a.size);
  return candidates[0]?.key || null;
};

/**
 * Extracts the primary MusicXML (score-partwise) document from an .mxl container.
 *
 * Notes:
 * - Most .mxl files include META-INF/container.xml pointing at the root MusicXML.
 * - If missing, we fall back to the largest .xml/.musicxml file inside the zip.
 */
export const extractMusicXmlFromMxl = async (buffer: ArrayBuffer): Promise<MxlExtraction> => {
  const bytes = new Uint8Array(buffer);
  const files = unzipSync(bytes);
  const fileList = Object.keys(files);
  const mainPath = findContainerRoot(files) || pickFallbackXml(files) || undefined;
  if (!mainPath || !files[mainPath]) {
    throw new Error('Unable to locate MusicXML inside .mxl (missing container.xml and no .xml files found).');
  }
  const xmlText = decodeUtf8(files[mainPath]);
  return { xmlText, mainPath, fileList };
};
