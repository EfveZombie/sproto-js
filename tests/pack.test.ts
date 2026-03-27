/**
 * Pack/Unpack tests
 *
 * Cross-validation with C-generated binary fixtures:
 *   pack(encoded) should produce the same bytes as C packed files.
 *   unpack(packed) should reproduce the C encoded files.
 *
 * Also includes self-consistency round-trip tests.
 */
import { describe, it, expect } from 'vitest';
import { loadTestData, hexdump, sproto } from './helpers.js';

// ============================================================================
// Cross-validation with C-generated fixtures (example 1–8)
// ============================================================================
describe('pack - cross-validation with C fixtures', () => {
  const examples = [1, 2, 3, 4, 5, 6, 7, 8];

  for (const n of examples) {
    it(`should pack example${n} to match C output`, () => {
      const encoded = loadTestData(`example${n}_encoded.bin`);
      const expectedPacked = loadTestData(`example${n}_packed.bin`);

      const packed = sproto.pack(encoded);
      expect(hexdump(packed)).toBe(hexdump(expectedPacked));
    });
  }

  it('should pack addressbook to match C output', () => {
    const encoded = loadTestData('addressbook_encoded.bin');
    const expectedPacked = loadTestData('addressbook_packed.bin');

    const packed = sproto.pack(encoded);
    expect(hexdump(packed)).toBe(hexdump(expectedPacked));
  });
});

describe('unpack - cross-validation with C fixtures', () => {
  const examples = [1, 2, 3, 4, 5, 6, 7, 8];

  for (const n of examples) {
    it(`should unpack example${n} to match C encoded output`, () => {
      const packed = loadTestData(`example${n}_packed.bin`);
      const expectedEncoded = loadTestData(`example${n}_encoded.bin`);

      const unpacked = sproto.unpack(packed);
      // Unpacked may have trailing zeros due to 8-byte alignment
      expect(unpacked.slice(0, expectedEncoded.length)).toEqual(expectedEncoded);
    });
  }

  it('should unpack addressbook to match C encoded output', () => {
    const packed = loadTestData('addressbook_packed.bin');
    const expectedEncoded = loadTestData('addressbook_encoded.bin');

    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, expectedEncoded.length)).toEqual(expectedEncoded);
  });
});

// ============================================================================
// Pack/Unpack round-trip self-consistency tests
// ============================================================================
describe('pack/unpack round-trip', () => {
  it('should round-trip simple 8-byte data', () => {
    const data = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should round-trip all-zeros data', () => {
    const data = new Array(32).fill(0);
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should round-trip all-0xFF data', () => {
    const data = new Array(32).fill(0xff);
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should round-trip mixed data', () => {
    const data = [
      0x00, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04,
      0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8,
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should round-trip single byte data', () => {
    const data = [0x42];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    // Due to 8-byte alignment, result may be longer
    expect(unpacked[0]).toBe(0x42);
  });

  it('should round-trip large data (1KB)', () => {
    const data: number[] = [];
    for (let i = 0; i < 1024; i++) {
      data.push(i % 256);
    }
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should compress data with many zeros', () => {
    const data = new Array(64).fill(0);
    const packed = sproto.pack(data);
    // Packed should be smaller than original
    expect(packed.length).toBeLessThan(data.length);
  });

  it('should round-trip non-aligned data (not multiple of 8)', () => {
    const data = [1, 2, 3, 4, 5]; // 5 bytes, not aligned
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should round-trip data with alternating zeros and non-zeros', () => {
    const data = [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});
