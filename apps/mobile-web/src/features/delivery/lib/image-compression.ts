const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.76;

export async function compressImage(input: {
  dataUrl: string;
  outputType?: string;
  maxEdge?: number;
  quality?: number;
}): Promise<Blob> {
  const image = await loadImage(input.dataUrl);
  const maxEdge = input.maxEdge ?? DEFAULT_MAX_EDGE;
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image compression is not available.");
  }

  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Image compression failed."));
      },
      input.outputType ?? "image/jpeg",
      input.quality ?? DEFAULT_QUALITY,
    );
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = dataUrl;
  });
}
