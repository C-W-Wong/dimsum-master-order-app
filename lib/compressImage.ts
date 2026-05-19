"use client";

export type CompressedImage = {
  /** base64, no data: prefix */
  data: string;
  mediaType: "image/jpeg";
  /** Size of the compressed bytes, in bytes. */
  bytes: number;
  /** Resulting pixel dimensions. */
  width: number;
  height: number;
  /** Object URL of the compressed image — caller is responsible for revoking. */
  previewUrl: string;
};

/**
 * Resize + re-encode an image so it fits comfortably inside a serverless body
 * limit and Claude's vision input. Phones routinely produce 8-15 MB HEIC/JPEGs
 * — we drop them to ~300-800 KB JPEGs without losing menu legibility.
 */
export async function compressImage(
  file: File,
  { maxEdge = 1600, quality = 0.85 }: { maxEdge?: number; quality?: number } = {}
): Promise<CompressedImage> {
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality
    );
  });

  const buf = await blob.arrayBuffer();
  const data = bytesToBase64(new Uint8Array(buf));

  return {
    data,
    mediaType: "image/jpeg",
    bytes: buf.byteLength,
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap handles EXIF orientation since Chrome 81+ and Safari 15+
  // — the fallback path uses <img> which the browser also auto-rotates.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      /* Safari < 15 / iOS 14 falls through */
    }
  }
  return await loadImgElement(file);
}

function loadImgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("failed to decode image"));
    };
    img.src = url;
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  // Chunk to avoid "Maximum call stack size exceeded" on large arrays.
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    s += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    );
  }
  return btoa(s);
}
