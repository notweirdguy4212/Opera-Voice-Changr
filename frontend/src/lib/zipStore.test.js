import { describe, expect, it } from 'vitest';
import { createZipStore } from './zipStore';

describe('createZipStore', () => {
  it('creates a ZIP archive with local and central directory signatures', async () => {
    const archive = await createZipStore([{ name: 'audio/sample.wav', data: new Blob([new Uint8Array([1, 2, 3])]) }]);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const signatures = Array.from(bytes.slice(0, 4));
    expect(signatures).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(archive.type).toBe('application/zip');
    expect(Array.from(bytes).some((value, index) => value === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x01 && bytes[index + 3] === 0x02)).toBe(true);
  });
});
