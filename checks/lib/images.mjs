/**
 * Размеры картинки по её байтам: PNG, JPEG и WebP.
 *
 * Нужен проверкам, которые сверяют `width`/`height` в разметке и данных
 * с самими файлами. После перевода картинок в WebP старый разбор заголовка
 * PNG (`readUInt32BE(16)`) читал не размеры, а мусор из VP8-заголовка,
 * поэтому формат определяется по сигнатуре, а не предполагается.
 *
 * Поддерживаются три формата, которые есть в проекте:
 *   — PNG: сигнатура и IHDR сразу после неё;
 *   — JPEG: обход маркеров до SOFn;
 *   — WebP: контейнер RIFF с чанком VP8X (расширенный), VP8 (с потерями)
 *     или VP8L (без потерь).
 *
 * @param {Buffer} buffer содержимое файла
 * @returns {{format: 'png'|'jpeg'|'webp'|null, width: number, height: number}|null}
 */
export function imageSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;

  /* ── PNG ── */
  if (buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  /* ── WebP ── */
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF'
    && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    const chunk = buffer.slice(12, 16).toString('ascii');

    /* VP8X: 1 байт флагов, затем ширина и высота минус единица по 3 байта */
    if (chunk === 'VP8X') {
      const width = buffer.readUIntLE(24, 3) + 1;
      const height = buffer.readUIntLE(27, 3) + 1;
      return { format: 'webp', width, height };
    }

    /* VP8 (с потерями): сигнатура 9d 01 2a, затем 14 бит ширины и высоты */
    if (chunk === 'VP8 ') {
      const start = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
      if (start === -1) return null;
      const width = buffer.readUInt16LE(start + 3) & 0x3fff;
      const height = buffer.readUInt16LE(start + 5) & 0x3fff;
      return { format: 'webp', width, height };
    }

    /* VP8L (без потерь): 0x2f и 14+14 бит размеров минус единица */
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { format: 'webp', width, height };
    }

    return null;
  }

  /* ── JPEG: идём по маркерам до кадра ── */
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);

      /* SOF0…SOF15, кроме служебных DHT (c4), JPG (c8), DAC (cc) */
      if (marker >= 0xc0 && marker <= 0xcf
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          format: 'jpeg',
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + length;
    }
    return null;
  }

  return null;
}
