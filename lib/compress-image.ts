/**
 * Comprime imagem raster no browser (JPEG) para reduzir payload em base64.
 */
export async function compressImageToJpegBase64(
  file: File,
  maxSizeKB = 4096
): Promise<{ base64: string; dataUrl: string } | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const finish = (value: { base64: string; dataUrl: string } | null) => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      resolve(value);
    };
    img.onerror = () => finish(null);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          finish(null);
          return;
        }
        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        let result = canvas.toDataURL("image/jpeg", quality);
        while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        const comma = result.indexOf(",");
        if (comma < 0) {
          finish(null);
          return;
        }
        finish({ base64: result.slice(comma + 1), dataUrl: result });
      } catch {
        finish(null);
      }
    };
    img.src = objectUrl;
  });
}
