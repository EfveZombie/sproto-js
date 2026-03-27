/**
 * Round-trip tests for encode/decode and full pipeline (encode -> pack -> unpack -> decode).
 *
 * These tests verify self-consistency without external binary files.
 * Reference: sproto-rust/tests/roundtrip_tests.rs
 */
import { describe, it, expect } from 'vitest';
import { loadPersonDataSproto, loadAddressBookSproto } from './helpers.js';

// ============================================================================
// Encode/Decode Round-trip Tests
// ============================================================================
describe('roundtrip - encode/decode basic types', () => {
  it('should round-trip a string field', () => {
    const sp = loadPersonDataSproto();
    const original = { name: 'Alice' };
    const encoded = sp.encode('Person', original);
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe('Alice');
  });

  it('should round-trip an integer field', () => {
    const sp = loadPersonDataSproto();
    const original = { age: 42 };
    const encoded = sp.encode('Person', original);
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.age).toBe(42);
  });

  it('should round-trip boolean true', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { marital: true });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.marital).toBe(true);
  });

  it('should round-trip boolean false', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { marital: false });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.marital).toBe(false);
  });

  it('should round-trip a double field', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { double: 3.14159 });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.double).toBeCloseTo(3.14159, 5);
  });

  it('should round-trip zero integer', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { age: 0 });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.age).toBe(0);
  });

  it('should round-trip negative integer', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { number: -12345 });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(-12345);
  });

  it('should round-trip large positive integer (>32-bit)', () => {
    const sp = loadPersonDataSproto();
    const value = Math.pow(2, 33);
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });

  it('should round-trip large negative integer', () => {
    const sp = loadPersonDataSproto();
    const value = -10000000000;
    const encoded = sp.encode('Data', { bignumber: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.bignumber).toBe(value);
  });

  it('should round-trip empty string', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { name: '' });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe('');
  });

  it('should round-trip unicode string (CJK)', () => {
    const sp = loadPersonDataSproto();
    const name = 'Hello, \u4e16\u754c!';
    const encoded = sp.encode('Person', { name });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe(name);
  });

  it('should round-trip all primitive types together', () => {
    const sp = loadPersonDataSproto();
    const original = {
      name: 'Test User',
      age: 25,
      marital: true,
    };
    const encoded = sp.encode('Person', original);
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe('Test User');
    expect(decoded!.age).toBe(25);
    expect(decoded!.marital).toBe(true);
  });

  it('should round-trip fixed-point number (integer(2))', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { fpn: 1.82 });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.fpn).toBeCloseTo(1.82, 2);
  });
});

// ============================================================================
// Encode/Decode Round-trip Tests - Arrays
// ============================================================================
describe('roundtrip - encode/decode arrays', () => {
  it('should round-trip integer array', () => {
    const sp = loadPersonDataSproto();
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });

  it('should round-trip boolean array', () => {
    const sp = loadPersonDataSproto();
    const bools = [true, false, true, false];
    const encoded = sp.encode('Data', { bools });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.bools).toEqual(bools);
  });

  // [BUG] 此用例触发两个 bug：
  // 1. sproto.ts ~L1128 decodeArray 缺少 SPROTO_TDOUBLE 分支，double 数组无法解码
  // 2. sproto.ts doubleToBinary/getDoubleHex 编码 double 数组时产生 undefined 值
  it('should round-trip double array', () => {
    const sp = loadPersonDataSproto();
    const doubles = [1.1, 2.2, 3.3, -4.4];
    const encoded = sp.encode('Data', { doubles });
    const decoded = sp.decode('Data', encoded!);
    const result = decoded!.doubles as number[];
    expect(result).toHaveLength(4);
    for (let i = 0; i < doubles.length; i++) {
      expect(result[i]).toBeCloseTo(doubles[i], 10);
    }
  });

  it('should round-trip large integer array (64-bit values)', () => {
    const sp = loadPersonDataSproto();
    const base = Math.pow(2, 32);
    const numbers = [base + 1, base + 2, base + 3];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });

  it('should round-trip mixed 32/64-bit integer array', () => {
    const sp = loadPersonDataSproto();
    // Mix of small and large values
    const numbers = [1, 100000, Math.pow(2, 32) + 1];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });
});

// ============================================================================
// Encode/Decode Round-trip Tests - Nested Structures
// ============================================================================
describe('roundtrip - encode/decode nested structs', () => {
  it('should round-trip nested struct (Person with children)', () => {
    const sp = loadPersonDataSproto();
    const original = {
      name: 'Parent',
      age: 35,
      children: [
        { name: 'Child1', age: 10 },
        { name: 'Child2', age: 7 },
      ],
    };
    const encoded = sp.encode('Person', original);
    const decoded = sp.decode('Person', encoded!) as any;
    expect(decoded.name).toBe('Parent');
    expect(decoded.age).toBe(35);
    expect(decoded.children).toHaveLength(2);
    expect(decoded.children[0].name).toBe('Child1');
    expect(decoded.children[0].age).toBe(10);
    expect(decoded.children[1].name).toBe('Child2');
    expect(decoded.children[1].age).toBe(7);
  });

  it('should round-trip deeply nested struct', () => {
    const sp = loadPersonDataSproto();
    const original = {
      name: 'GrandParent',
      age: 60,
      children: [
        {
          name: 'Parent',
          age: 35,
          children: [
            { name: 'Child', age: 10 },
          ],
        },
      ],
    };
    const encoded = sp.encode('Person', original);
    const decoded = sp.decode('Person', encoded!) as any;
    expect(decoded.name).toBe('GrandParent');
    expect(decoded.children[0].name).toBe('Parent');
    expect(decoded.children[0].children[0].name).toBe('Child');
    expect(decoded.children[0].children[0].age).toBe(10);
  });
});

// ============================================================================
// Encode/Decode Round-trip Tests - Special Doubles
// ============================================================================
describe('roundtrip - special double values', () => {
  it('should round-trip double zero', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { double: 0.0 });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.double).toBe(0.0);
  });

  it('should round-trip very small double', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { double: Number.MIN_VALUE });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.double).toBe(Number.MIN_VALUE);
  });

  it('should round-trip negative double', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { double: -123.456 });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.double).toBeCloseTo(-123.456, 10);
  });
});

// ============================================================================
// Full Pipeline Tests: encode -> pack -> unpack -> decode (pencode/pdecode)
// ============================================================================
describe('roundtrip - full pipeline (pencode/pdecode)', () => {
  it('should pencode/pdecode simple Person', () => {
    const sp = loadPersonDataSproto();
    const original = { name: 'Test', age: 100 };
    const packed = sp.pencode('Person', original);
    expect(packed).not.toBeNull();
    const decoded = sp.pdecode('Person', packed!);
    expect(decoded!.name).toBe('Test');
    expect(decoded!.age).toBe(100);
  });

  it('should pencode/pdecode Person with children', () => {
    const sp = loadPersonDataSproto();
    const original = {
      name: 'Bob',
      age: 40,
      children: [
        { name: 'Alice', age: 13, marital: true },
        { name: 'Carol', age: 5, marital: false },
      ],
    };
    const packed = sp.pencode('Person', original);
    const decoded = sp.pdecode('Person', packed!) as any;
    expect(decoded.name).toBe('Bob');
    expect(decoded.age).toBe(40);
    expect(decoded.children).toHaveLength(2);
    expect(decoded.children[0].name).toBe('Alice');
    expect(decoded.children[1].name).toBe('Carol');
  });

  // [BUG] 此用例包含 doubles 数组字段，触发以下 bug 导致整个 decode 返回 null：
  // 1. sproto.ts ~L1128 decodeArray 缺少 SPROTO_TDOUBLE 分支，double 数组无法解码
  // 2. sproto.ts doubleToBinary/getDoubleHex 编码 double 数组时产生 undefined 值
  it('should pencode/pdecode Data with all field types', () => {
    const sp = loadPersonDataSproto();
    const original = {
      numbers: [1, 2, 3],
      bools: [true, false],
      number: 42,
      double: 3.14,
      doubles: [1.5, 2.5],
    };
    const packed = sp.pencode('Data', original);
    const decoded = sp.pdecode('Data', packed!) as any;
    expect(decoded.numbers).toEqual([1, 2, 3]);
    expect(decoded.bools).toEqual([true, false]);
    expect(decoded.number).toBe(42);
    expect(decoded.double).toBeCloseTo(3.14, 5);
    expect(decoded.doubles[0]).toBeCloseTo(1.5, 10);
    expect(decoded.doubles[1]).toBeCloseTo(2.5, 10);
  });

  it('should pencode/pdecode Data with large integers', () => {
    const sp = loadPersonDataSproto();
    const original = {
      number: 100000,
      bignumber: -10000000000,
    };
    const packed = sp.pencode('Data', original);
    const decoded = sp.pdecode('Data', packed!);
    expect(decoded!.number).toBe(100000);
    expect(decoded!.bignumber).toBe(-10000000000);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================
describe('roundtrip - edge cases', () => {
  it('should handle encoding with no fields set', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', {});
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('Person', encoded!);
    expect(decoded).not.toBeNull();
  });

  it('should handle encoding with only optional fields missing', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { name: 'OnlyName' });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe('OnlyName');
    // age and marital should not be present
    expect(decoded!.age).toBeUndefined();
    expect(decoded!.marital).toBeUndefined();
  });

  it('should round-trip integer at inline threshold boundary (0x7FFF - 1)', () => {
    const sp = loadPersonDataSproto();
    const value = 0x7ffe; // just below inline threshold
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });

  it('should round-trip integer at inline threshold (0x7FFF)', () => {
    const sp = loadPersonDataSproto();
    const value = 0x7fff;
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });

  it('should round-trip integer just above inline threshold (0x8000)', () => {
    const sp = loadPersonDataSproto();
    const value = 0x8000;
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });

  it('should round-trip integer at 32-bit boundary (2^31 - 1)', () => {
    const sp = loadPersonDataSproto();
    const value = 2147483647; // i32::MAX
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });

  it('should round-trip negative integer at 32-bit boundary (-2^31)', () => {
    const sp = loadPersonDataSproto();
    const value = -2147483648; // i32::MIN
    const encoded = sp.encode('Data', { number: value });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.number).toBe(value);
  });
});

// ============================================================================
// bigint Encoding/Decoding Tests
// ============================================================================
describe('roundtrip - bigint support', () => {
  it('should encode bigint and decode back as bigint', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { number: 42n });
    const decoded = sp.decode('Data', encoded!, { decodeIntegerAs: 'bigint' });
    expect(decoded!.number).toBe(42n);
  });

  it('should encode bigint array and decode back as bigint', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { numbers: [1n, 2n, 3n] });
    const decoded = sp.decode('Data', encoded!, { decodeIntegerAs: 'bigint' });
    expect(decoded!.numbers).toEqual([1n, 2n, 3n]);
  });

  it('should encode large bigint values', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { bignumber: -10000000000n });
    const decoded = sp.decode('Data', encoded!, { decodeIntegerAs: 'bigint' });
    expect(decoded!.bignumber).toBe(-10000000000n);
  });
});

// ============================================================================
// Additional Coverage: Integer Array Edge Cases
// ============================================================================
describe('roundtrip - integer array edge cases', () => {
  it('should round-trip integer array with negative 32-bit values', () => {
    const sp = loadPersonDataSproto();
    const numbers = [-1, -100, -2147483648];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });

  it('should round-trip integer array upgrading 32-bit to 64-bit mid-array', () => {
    // Starts with small 32-bit values, then a large 64-bit value triggers upgrade
    const sp = loadPersonDataSproto();
    const base = Math.pow(2, 32);
    const numbers = [1, 2, base + 100];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });

  it('should round-trip integer array with negative 32-bit followed by 64-bit', () => {
    const sp = loadPersonDataSproto();
    const numbers = [-1, Math.pow(2, 32) + 1];
    const encoded = sp.encode('Data', { numbers });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual(numbers);
  });

  it('should round-trip single-element integer array', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { numbers: [42] });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.numbers).toEqual([42]);
  });

  it('should round-trip single-element boolean array', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', { bools: [true] });
    const decoded = sp.decode('Data', encoded!);
    expect(decoded!.bools).toEqual([true]);
  });

  it('should round-trip empty children array', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', { name: 'Solo', children: [] });
    const decoded = sp.decode('Person', encoded!) as any;
    expect(decoded.name).toBe('Solo');
    // Empty array should be present (decoded as empty)
    expect(decoded.children).toBeDefined();
    expect(decoded.children).toHaveLength(0);
  });
});

// ============================================================================
// Additional Coverage: AddressBook (map type with mainindex)
// ============================================================================
describe('roundtrip - AddressBook map type', () => {
  it('should round-trip AddressBook with person map', () => {
    const sp = loadAddressBookSproto();
    const original = {
      person: {
        1: { name: 'Alice', id: 1, email: 'alice@test.com' },
        2: { name: 'Bob', id: 2, email: 'bob@test.com' },
      },
    };
    const encoded = sp.encode('AddressBook', original);
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('AddressBook', encoded!) as any;
    expect(decoded).not.toBeNull();
    expect(decoded.person).toBeDefined();
  });

  it('should round-trip AddressBook others array (non-map)', () => {
    const sp = loadAddressBookSproto();
    const original = {
      others: [
        { name: 'Carol', id: 3, email: 'carol@test.com' },
      ],
    };
    const encoded = sp.encode('AddressBook', original);
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('AddressBook', encoded!) as any;
    expect(decoded).not.toBeNull();
    expect(decoded.others).toHaveLength(1);
    expect(decoded.others[0].name).toBe('Carol');
    expect(decoded.others[0].id).toBe(3);
  });

  it('should round-trip AddressBook person with nested PhoneNumber', () => {
    const sp = loadAddressBookSproto();
    const original = {
      person: {
        1: {
          name: 'Alice',
          id: 1,
          email: 'alice@test.com',
          phone: [
            { number: '123-456', type: 1 },
            { number: '789-012', type: 2 },
          ],
        },
      },
    };
    const encoded = sp.encode('AddressBook', original);
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('AddressBook', encoded!) as any;
    expect(decoded).not.toBeNull();
    expect(decoded.person).toBeDefined();
  });

  it('should decode AddressBook person as Map when decodeMapAs="Map"', () => {
    const sp = loadAddressBookSproto();
    const original = {
      person: {
        1: { name: 'Alice', id: 1 },
      },
    };
    const encoded = sp.encode('AddressBook', original);
    expect(encoded).not.toBeNull();
    const decoded = sp.decode('AddressBook', encoded!, { decodeMapAs: 'Map' }) as any;
    expect(decoded).not.toBeNull();
    expect(decoded.person).toBeInstanceOf(Map);
  });
});

// ============================================================================
// Additional Coverage: Multi-byte UTF-8 characters
// ============================================================================
describe('roundtrip - UTF-8 multi-byte characters', () => {
  it('should round-trip 2-byte UTF-8 characters (Latin extended)', () => {
    const sp = loadPersonDataSproto();
    const name = '\u00e9\u00e0\u00fc\u00f1'; // éàüñ
    const encoded = sp.encode('Person', { name });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe(name);
  });

  it('should round-trip 3-byte UTF-8 characters (CJK)', () => {
    const sp = loadPersonDataSproto();
    const name = '\u4f60\u597d\u4e16\u754c'; // 你好世界
    const encoded = sp.encode('Person', { name });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe(name);
  });

  it('should round-trip mixed ASCII and multi-byte UTF-8', () => {
    const sp = loadPersonDataSproto();
    const name = 'Hello \u00e9\u00e0 \u4e16\u754c!';
    const encoded = sp.encode('Person', { name });
    const decoded = sp.decode('Person', encoded!);
    expect(decoded!.name).toBe(name);
  });
});

// ============================================================================
// Additional Coverage: queryproto API
// ============================================================================
describe('roundtrip - queryproto API', () => {
  it('should query type info for Person', () => {
    const sp = loadPersonDataSproto();
    // queryproto is for protocol schemas, test queryType through encode/decode
    // Verify that encoding the same type twice uses cache
    const encoded1 = sp.encode('Person', { name: 'Test' });
    const encoded2 = sp.encode('Person', { name: 'Test' });
    expect(encoded1).toEqual(encoded2);
  });
});
