'use strict';
/* Retratos: formato do arquivo é livre. Apenas a exibição tem moldura vertical.
   A imagem é recodificada para WebP sem EXIF. Frontalidade e identidade são
   verificadas por pessoas, não inferidas de pixels nem de tamanho da imagem. */
(function (scope) {
  const MIN_WIDTH = 320;
  const MIN_HEIGHT = 320;
  const MAX_DIMENSION = 8192;
  const MAX_FILE = 5 * 1024 * 1024;
  const MAX_OUTPUT = 1536 * 1024;
  const MAX_SIDE = 1600;
  const TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

  function validateFile(file) {
    if (!file || !TYPES.includes(file.type) || !Number.isFinite(file.size) || file.size < 1 || file.size > MAX_FILE) {
      throw new Error('Selecione uma fotografia JPG, PNG ou WebP de até 5 MB.');
    }
  }
  function optionsFor(input = {}) {
    const n = (x, fallback) => x === undefined ? fallback : Number(x);
    const zoom = n(input.zoom, 1);
    const panX = n(input.panX, 50);
    const panY = n(input.panY, 50);
    if (![zoom, panX, panY].every(Number.isFinite) || zoom < 1 || zoom > 2.5 || panX < 0 || panX > 100 || panY < 0 || panY > 100) {
      throw new Error('Ajuste de enquadramento inválido.');
    }
    return { zoom, panX, panY };
  }
  function crop(width, height, options = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < MIN_WIDTH || height < MIN_HEIGHT || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error('Escolha uma foto nítida de pelo menos 320 pixels em cada lado.');
    }
    const { zoom, panX, panY } = optionsFor(options);
    const sw = Math.max(1, Math.round(width / zoom));
    const sh = Math.max(1, Math.round(height / zoom));
    const sx = Math.round((width - sw) * panX / 100);
    const sy = Math.round((height - sh) * panY / 100);
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    return { sx, sy, sw, sh, width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)) };
  }
  async function process(file, options = {}) {
    validateFile(file);
    const image = await createImageBitmap(file);
    try {
      const rect = crop(image.width, image.height, options);
      const canvas = document.createElement('canvas');
      canvas.width = rect.width; canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível preparar a fotografia.');
      ctx.fillStyle = '#f2f4f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.width, rect.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        value => value?.type === 'image/webp' ? resolve(value) : reject(new Error('Conversão WebP indisponível neste navegador.')),
        'image/webp', 0.84
      ));
      if (blob.size > MAX_OUTPUT) throw new Error('A imagem ultrapassou 1,5 MB após a conversão. Escolha uma foto menor.');
      return blob;
    } finally { image.close(); }
  }
  const api = Object.freeze({ MIN_WIDTH, MIN_HEIGHT, MAX_FILE, MAX_OUTPUT, MAX_SIDE, validateFile, crop, process });
  scope.SQFPortrait = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
