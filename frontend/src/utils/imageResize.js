/**
 * Helper to process and resize avatar images using HTML5 Canvas
 */
export function processAvatarImage(file, maxDim = 256, quality = 0.88) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided.'));
    }
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (PNG, JPG, WebP).'));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('Image exceeds 5MB. Please choose a smaller photo.'));
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');

          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;

          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxDim, maxDim);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (_) {
          resolve(uploadEvent.target.result);
        }
      };
      img.onerror = () => reject(new Error('Failed to read image file.'));
      img.src = uploadEvent.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

