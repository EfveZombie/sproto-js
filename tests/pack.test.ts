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

// ============================================================================
// Additional Coverage: packSeg branch patterns
// ============================================================================
describe('pack - packSeg branch patterns', () => {
  it('should handle group with 1 non-zero byte', () => {
    const data = [1, 0, 0, 0, 0, 0, 0, 0];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle group with 2 non-zero bytes', () => {
    const data = [1, 0, 2, 0, 0, 0, 0, 0];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle group with 5 non-zero bytes', () => {
    const data = [1, 2, 3, 4, 5, 0, 0, 0];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle group with 6 non-zero bytes followed by another group (notzero promoted to 8)', () => {
    // 6 non-zero bytes in first group, promoted to ff segment because n > 0
    const data = [
      1, 2, 3, 4, 5, 6, 0, 0,   // 6 non-zero → promoted to 8 (ff)
      9, 10, 11, 12, 13, 14, 15, 16,  // second group forces n > 0
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle group with 7 non-zero bytes followed by another group (notzero promoted to 8)', () => {
    // 7 non-zero bytes in first group, promoted to ff segment because n > 0
    const data = [
      1, 2, 3, 4, 5, 6, 7, 0,   // 7 non-zero → promoted to 8 (ff)
      9, 10, 11, 12, 13, 14, 15, 16,  // second group forces n > 0
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle group with 8 non-zero bytes (ff segment) followed by another group', () => {
    // All 8 bytes non-zero → ff segment, n > 0 returns 8
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,   // 8 non-zero → ff segment
      9, 10, 11, 12, 13, 14, 15, 16,  // second group
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle 6 non-zero bytes as last group (no promotion)', () => {
    // 6 non-zero bytes as the only/last group, n === 0, no promotion
    const data = [1, 2, 3, 4, 5, 6, 0, 0];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Additional Coverage: consecutive ff segments (writeFf path)
// ============================================================================
describe('pack - consecutive ff segments (writeFf path)', () => {
  it('should handle three consecutive all-nonzero groups followed by a sparse group', () => {
    // Three ff segments then a normal segment → triggers writeFf with ffN > 1
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
      21, 22, 23, 24, 25, 26, 27, 28, // ff segment 3
      1, 0, 0, 0, 0, 0, 0, 0,        // sparse segment → triggers writeFf for previous 3
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle two consecutive all-nonzero groups at end of data', () => {
    // Two ff segments at end → triggers writeFf with ffN > 1 at end of sprotoPack
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle single all-nonzero group at end of data', () => {
    // Single ff segment at end → triggers writeFf with ffN === 1
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle large data with many consecutive ff segments', () => {
    // 10 consecutive all-nonzero groups
    const data: number[] = [];
    for (let i = 0; i < 80; i++) {
      data.push((i % 255) + 1); // all non-zero
    }
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Additional Coverage: ff segment followed by sparse segment (writeFf mid-stream)
// ============================================================================
describe('pack - ff segment followed by sparse segment (writeFf mid-stream)', () => {
  it('should handle ff segment followed by sparse segment (triggers writeFf at L1274-1275)', () => {
    // Two consecutive all-nonzero 8-byte groups (establish ff segment, ffN=2)
    // then a sparse group with only 1-2 non-zero bytes
    // When processing 3rd group, packSeg returns not 8 or 10, and ffN>0, triggers writeFf
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1 (notzero=8, n=0 → returns 10, ffN=1)
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2 (notzero=8, n>0 → returns 8, ffN=2)
      1, 0, 0, 0, 0, 0, 0, 0,        // sparse segment (notzero=1 → returns 2, triggers writeFf for previous 2)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle ff segment followed by sparse segment with 2 non-zero bytes', () => {
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
      1, 2, 0, 0, 0, 0, 0, 0,        // sparse segment (notzero=2 → returns 3, triggers writeFf)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Additional Coverage: notzero promotion (6/7 non-zero bytes after ff start)
// ============================================================================
describe('pack - notzero promotion (6/7 non-zero bytes after ff start)', () => {
  it('should promote notzero from 6 to 8 after ff segment start (L1144-1145)', () => {
    // 16 bytes: first 8 bytes all non-zero (triggers notzero=8, n=0 → returns 10, ffN=1)
    // second 8 bytes has 6 non-zero bytes and 2 zero bytes (triggers notzero=6, n=1(ffN>0) → promoted to 8)
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1 (notzero=8, n=0 → returns 10, ffN=1)
      9, 10, 11, 12, 13, 14, 0, 0,   // 6 non-zero → notzero=6, n=1 → promoted to 8 (returns 8, ffN=2)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should promote notzero from 7 to 8 after ff segment start (L1144-1145)', () => {
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1 (notzero=8, n=0 → returns 10, ffN=1)
      9, 10, 11, 12, 13, 14, 15, 0,   // 7 non-zero → notzero=7, n=1 → promoted to 8 (returns 8, ffN=2)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle 6 non-zero bytes as first group (no promotion, n=0)', () => {
    // 6 non-zero bytes as first group, n === 0, no promotion
    const data = [1, 2, 3, 4, 5, 6, 0, 0];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Additional Coverage: multiple consecutive ff segments
// ============================================================================
describe('pack - multiple consecutive ff segments', () => {
  it('should handle three consecutive all-nonzero groups (L1185-1186)', () => {
    // 24 bytes all non-zero (3 groups of 8 bytes)
    // Group 1: notzero=8, n=0 → returns 10 (ffN=1)
    // Group 2: notzero=8, n=1 → returns 8 (ffN=2)
    // Group 3: notzero=8, n=2 → returns 8 (ffN=3)
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1 (notzero=8, n=0 → returns 10, ffN=1)
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2 (notzero=8, n>0 → returns 8, ffN=2)
      21, 22, 23, 24, 25, 26, 27, 28, // ff segment 3 (notzero=8, n>0 → returns 8, ffN=3)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle four consecutive all-nonzero groups', () => {
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
      21, 22, 23, 24, 25, 26, 27, 28, // ff segment 3
      31, 32, 33, 34, 35, 36, 37, 38, // ff segment 4
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle consecutive ff segments ending with sparse data', () => {
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
      21, 22, 23, 24, 25, 26, 27, 28, // ff segment 3
      1, 0, 0, 0, 0, 0, 0, 0,        // sparse segment
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Additional Coverage: unpack edge cases
// ============================================================================
describe('unpack - edge cases', () => {
  it('should unpack empty array', () => {
    const unpacked = sproto.unpack([]);
    expect(unpacked).toEqual([]);
  });

  it('should unpack header=0x00 (8 zero bytes)', () => {
    const unpacked = sproto.unpack([0x00]);
    expect(unpacked).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('should unpack header with single bit set', () => {
    // header=0x01 means byte 0 is non-zero, rest are zero
    const unpacked = sproto.unpack([0x01, 0x42]);
    expect(unpacked[0]).toBe(0x42);
    expect(unpacked.slice(1, 8)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('should unpack ff segment', () => {
    // ff header followed by count=0 (1 group of 8 bytes)
    const unpacked = sproto.unpack([0xff, 0x00, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(unpacked.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('should return empty array for malformed packed data (L1274-1275)', () => {
    // Malformed ff segment: 0xff header but insufficient data following
    // This triggers sz < 0 check in sprotoUnpack
    const result = sproto.unpack([0xff, 0x05]); // claims 48 bytes but only 1 byte available
    expect(result).toEqual([]);
  });

  it('should return empty array for ff segment with truncated data', () => {
    // ff header with count but insufficient actual data
    const result = sproto.unpack([0xff, 0x02, 1, 2]); // claims 24 bytes but only 2 available
    expect(result).toEqual([]);
  });
});

// ============================================================================
// Coverage: L1229-1233 - writeFf flush at end of sprotoPack
// ============================================================================
describe('pack - writeFf flush at end (L1229-1233)', () => {
  it('should flush ff segment at end of data (ffN > 1)', () => {
    // Two consecutive all-nonzero 8-byte groups at end
    // Triggers writeFf with ffN > 1 at L1229-1233
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should flush single ff segment at end (ffN === 1)', () => {
    // Single all-nonzero 8-byte group at end
    // Triggers writeFf with ffN === 1 at L1229-1233
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should flush three ff segments at end', () => {
    // Three consecutive all-nonzero groups at end
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Coverage: L1144-1145 - packSeg notzero===8 with n>0
// ============================================================================
describe('pack - packSeg notzero===8 with n>0 (L1144-1145)', () => {
  it('should return 8 when notzero===8 and n>0', () => {
    // First group: all 8 bytes non-zero (notzero=8, n=0 → returns 10, ffN=1)
    // Second group: all 8 bytes non-zero (notzero=8, n=1 → returns 8, ffN=2)
    // This triggers L1144-1145: if (notzero === 8) { if (n > 0) return 8; }
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // ff segment 1 (notzero=8, n=0 → returns 10)
      11, 12, 13, 14, 15, 16, 17, 18, // ff segment 2 (notzero=8, n=1 → returns 8)
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should return 10 when notzero===8 and n===0', () => {
    // Single group with all 8 bytes non-zero
    // Triggers L1144-1145: if (notzero === 8) { if (n > 0) return 8; else return 10; }
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle three consecutive all-nonzero groups', () => {
    // Group 1: notzero=8, n=0 → returns 10
    // Group 2: notzero=8, n=1 → returns 8 (L1144-1145)
    // Group 3: notzero=8, n=2 → returns 8 (L1144-1145)
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});

// ============================================================================
// Coverage: L1185-1186 - sprotoPack sz===8 ff segment handling
// ============================================================================
describe('pack - sprotoPack sz===8 ff segment (L1185-1186)', () => {
  it('should increment ffN when sz===8 (all-nonzero group)', () => {
    // Multiple consecutive all-nonzero groups
    // Each group with sz===8 triggers ffN++ at L1185-1186
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // sz=8, ffN=0 → ffN=1
      11, 12, 13, 14, 15, 16, 17, 18, // sz=8, ffN=1 → ffN=2
      21, 22, 23, 24, 25, 26, 27, 28, // sz=8, ffN=2 → ffN=3
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle ff segments followed by sparse data', () => {
    // Two all-nonzero groups (ffN=2) then sparse group
    // Sparse group triggers writeFf for accumulated ff segments
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // sz=8, ffN=1
      11, 12, 13, 14, 15, 16, 17, 18, // sz=8, ffN=2
      1, 0, 0, 0, 0, 0, 0, 0,        // sz=2, triggers writeFf for ffN=2
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });

  it('should handle promoted groups (6/7 non-zero) in ff sequence', () => {
    // First group: all 8 non-zero (ffN=1)
    // Second group: 6 non-zero, promoted to 8 (ffN=2)
    // Third group: all 8 non-zero (ffN=3)
    const data = [
      1, 2, 3, 4, 5, 6, 7, 8,       // sz=8, ffN=1
      9, 10, 11, 12, 13, 14, 0, 0,   // 6 non-zero, promoted to sz=8, ffN=2
      21, 22, 23, 24, 25, 26, 27, 28, // sz=8, ffN=3
    ];
    const packed = sproto.pack(data);
    const unpacked = sproto.unpack(packed);
    expect(unpacked.slice(0, data.length)).toEqual(data);
  });
});
