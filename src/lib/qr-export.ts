/**
 * Print-quality QR downloads (browser only).
 *
 * The on-screen QR is a small <canvas>; exporting that gave a 96–120 px
 * PNG that blurs on a poster, and the "SVG" was that PNG wrapped in an
 * <svg>. These helpers render fresh from the `qrcode` library instead:
 * a 1024 px PNG and a real vector SVG, both with the brand logo in the
 * centre (error-correction level H tolerates the covered modules).
 */
import QRCode from "qrcode";

const DARK = "#0F172A";
const LIGHT = "#FFFFFF";
const LOGO_RATIO = 0.21; // logo width as a share of the QR width
const PNG_SIZE = 1024;

let iconDataUrl: Promise<string> | null = null;
function loadIconDataUrl(): Promise<string> {
  iconDataUrl ??= fetch("/icon.svg")
    .then((r) => r.text())
    .then((svg) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
  return iconDataUrl;
}

export async function qrPngBlob(value: string, size = PNG_SIZE): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: DARK, light: LIGHT },
  });
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const logo = new Image();
    logo.src = await loadIconDataUrl();
    await logo.decode();
    const s = Math.round(canvas.width * LOGO_RATIO);
    const pad = Math.round(s * 0.08);
    const x = Math.round((canvas.width - s) / 2);
    ctx.fillStyle = LIGHT;
    ctx.fillRect(x - pad, x - pad, s + pad * 2, s + pad * 2);
    ctx.drawImage(logo, x, x, s, s);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
  );
}

export async function qrSvgBlob(value: string): Promise<Blob> {
  let svg = await QRCode.toString(value, {
    type: "svg",
    margin: 2,
    width: PNG_SIZE,
    errorCorrectionLevel: "H",
    color: { dark: DARK, light: LIGHT },
  });
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
  if (m) {
    const n = Number(m[1]);
    const s = n * LOGO_RATIO;
    const pad = s * 0.08;
    const x = (n - s) / 2;
    const logo = await loadIconDataUrl();
    svg = svg.replace(
      "</svg>",
      `<rect x="${x - pad}" y="${x - pad}" width="${s + pad * 2}" height="${s + pad * 2}" fill="${LIGHT}"/>` +
        `<image href="${logo}" x="${x}" y="${x}" width="${s}" height="${s}"/></svg>`,
    );
  }
  return new Blob([svg], { type: "image/svg+xml" });
}

/** "qr-<title or code>" with characters illegal in filenames removed. */
export function qrFilename(title: string | null | undefined, code: string, ext: "png" | "svg"): string {
  const base = (title || code)
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || code;
  return `qr-${base}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
