/**
 * Decode tests
 *
 * Cross-validation: decode C-generated encoded binaries and verify field values.
 * Reference: sproto-rust/tests/decode_tests.rs
 */
import { describe, it, expect } from 'vitest';
import { loadTestData, loadPersonDataSproto, loadAddressBookSproto } from './helpers.js';

describe('decode - cross-validation with C fixtures', () => {
  // Example 1: Person { name="Alice", age=13, marital=false }
  it('should decode example1: Person { name="Alice", age=13, marital=false }', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example1_encoded.bin');
    const decoded = sp.decode('Person', data);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Alice');
    expect(decoded!.age).toBe(13);
    expect(decoded!.marital).toBe(false);
  });

  // Example 2: Person with children
  it('should decode example2: Person with children array', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example2_encoded.bin');
    const decoded = sp.decode('Person', data);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Bob');
    expect(decoded!.age).toBe(40);

    const children = decoded!.children as any[];
    expect(children).toHaveLength(2);

    expect(children[0].name).toBe('Alice');
    expect(children[0].age).toBe(13);

    expect(children[1].name).toBe('Carol');
    expect(children[1].age).toBe(5);
  });

  // Example 3: Data { numbers=[1,2,3,4,5] }
  it('should decode example3: Data { numbers=[1,2,3,4,5] }', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example3_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    const numbers = decoded!.numbers as number[];
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  // Example 4: Data { numbers=[(1<<32)+1, (1<<32)+2, (1<<32)+3] }
  it('should decode example4: Data with large 64-bit integers', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example4_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    const numbers = decoded!.numbers as number[];
    const base = Math.pow(2, 32);
    expect(numbers).toEqual([base + 1, base + 2, base + 3]);
  });

  // Example 5: Data { bools=[false, true, false] }
  it('should decode example5: Data { bools=[false, true, false] }', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example5_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    const bools = decoded!.bools as boolean[];
    expect(bools).toEqual([false, true, false]);
  });

  // Example 6: Data { number=100000, bignumber=-10000000000 }
  it('should decode example6: Data { number=100000, bignumber=-10000000000 }', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example6_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    expect(decoded!.number).toBe(100000);
    expect(decoded!.bignumber).toBe(-10000000000);
  });

  // Example 7: Data { double=0.01171875, doubles=[0.01171875, 23, 4] }
  // [BUG] sproto.ts ~L1128 decodeArray 的 switch 语句缺少 case CONSTANTS.SPROTO_TDOUBLE 分支，
  // 导致 double 类型数组解码时落入 default 分支返回 -1，doubles 字段解码失败。
  // 单个 double 字段解码正常（走的是 decodeField 而非 decodeArray），所以只有数组受影响。
  it('should decode example7: Data with double and doubles array', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example7_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    expect(decoded!.double).toBeCloseTo(0.01171875, 10);

    const doubles = decoded!.doubles as number[];
    expect(doubles).toHaveLength(3);
    expect(doubles[0]).toBeCloseTo(0.01171875, 10);
    expect(doubles[1]).toBeCloseTo(23.0, 10);
    expect(doubles[2]).toBeCloseTo(4.0, 10);
  });

  // Example 8: Data { fpn=1.82 }
  // fpn is integer(2), raw decoded value is 1.82 (182 / 100)
  it('should decode example8: Data { fpn=1.82 } (fixed-point integer(2))', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example8_encoded.bin');
    const decoded = sp.decode('Data', data);

    expect(decoded).not.toBeNull();
    expect(decoded!.fpn).toBeCloseTo(1.82, 10);
  });
});

describe('decode - options', () => {
  it('should decode integers as bigint when decodeIntegerAs="bigint"', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example1_encoded.bin');
    const decoded = sp.decode('Person', data, { decodeIntegerAs: 'bigint' });

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Alice');
    expect(decoded!.age).toBe(13n);
    expect(decoded!.marital).toBe(false);
  });

  it('should decode integer arrays as bigint when decodeIntegerAs="bigint"', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example3_encoded.bin');
    const decoded = sp.decode('Data', data, { decodeIntegerAs: 'bigint' });

    expect(decoded).not.toBeNull();
    const numbers = decoded!.numbers as bigint[];
    expect(numbers).toEqual([1n, 2n, 3n, 4n, 5n]);
  });
});

describe('decode - AddressBook (map type, nested struct)', () => {
  it('should decode addressbook with Person(id) map field', () => {
    const sp = loadAddressBookSproto();
    const data = loadTestData('addressbook_encoded.bin');
    const decoded = sp.decode('AddressBook', data);

    expect(decoded).not.toBeNull();
    // person field is a map keyed by id
    const person = decoded!.person;
    expect(person).toBeDefined();
  });

  it('should decode addressbook with decodeMapAs="Map"', () => {
    const sp = loadAddressBookSproto();
    const data = loadTestData('addressbook_encoded.bin');
    const decoded = sp.decode('AddressBook', data, { decodeMapAs: 'Map' });

    expect(decoded).not.toBeNull();
    const person = decoded!.person;
    expect(person).toBeDefined();
    // When decodeMapAs="Map", person should be a Map instance
    expect(person).toBeInstanceOf(Map);
  });
});

describe('decode - additional coverage', () => {
  it('should return decoded size via objlen', () => {
    const sp = loadPersonDataSproto();
    const data = loadTestData('example1_encoded.bin');
    const len = sp.objlen('Person', data);
    expect(len).not.toBeNull();
    expect(len).toBeGreaterThan(0);
    expect(len).toBe(data.length);
  });

  it('should return null for unknown type name', () => {
    const sp = loadPersonDataSproto();
    const result = sp.encode('NonExistentType', { foo: 1 });
    expect(result).toBeNull();
  });

  it('should return null for decoding unknown type name', () => {
    const sp = loadPersonDataSproto();
    const result = sp.decode('NonExistentType', [0, 0]);
    expect(result).toBeNull();
  });
});
