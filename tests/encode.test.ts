/**
 * Encode tests
 *
 * Cross-validation: encode in JS and compare bytes with C-generated .bin files.
 * Reference: sproto-rust/tests/encode_tests.rs
 */
import { describe, it, expect } from 'vitest';
import { loadTestData, hexdump, loadPersonDataSproto, loadAddressBookSproto } from './helpers.js';

describe('encode - cross-validation with C fixtures', () => {
  // [BUG] sproto.ts 编码回调处理缺陷：
  // 当对象中不存在某个数组字段时（如 Person 缺少 children，或 Data 缺少 numbers/bools/doubles），
  // 编码回调应返回 SPROTO_CB_NOARRAY 以跳过该字段，但当前实现在 sproto.ts ~L1491 处
  // 检查 typeof value !== "object" 时返回 SPROTO_CB_NIL，而 undefined 的 typeof 是 "undefined"
  // 不是 "object"，导致缺失的数组字段未被正确跳过，编码结果与 C 参考实现不一致。
  // 此 bug 导致本 describe 下所有用例失败。

  // Example 1: Person { name="Alice", age=13, marital=false }
  it('should encode example1: Person { name="Alice", age=13, marital=false }', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', {
      name: 'Alice',
      age: 13,
      marital: false,
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example1_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 2: Person { name="Bob", age=40, children=[{name="Alice",age=13},{name="Carol",age=5}] }
  it('should encode example2: Person with children', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Person', {
      name: 'Bob',
      age: 40,
      children: [
        { name: 'Alice', age: 13 },
        { name: 'Carol', age: 5 },
      ],
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example2_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 3: Data { numbers=[1,2,3,4,5] }
  it('should encode example3: Data { numbers=[1,2,3,4,5] }', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', {
      numbers: [1, 2, 3, 4, 5],
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example3_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 4: Data { numbers=[(1<<32)+1, (1<<32)+2, (1<<32)+3] }
  it('should encode example4: Data with large 64-bit integers', () => {
    const sp = loadPersonDataSproto();
    const base = Math.pow(2, 32);
    const encoded = sp.encode('Data', {
      numbers: [base + 1, base + 2, base + 3],
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example4_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 5: Data { bools=[false, true, false] }
  it('should encode example5: Data { bools=[false, true, false] }', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', {
      bools: [false, true, false],
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example5_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 6: Data { number=100000, bignumber=-10000000000 }
  it('should encode example6: Data { number=100000, bignumber=-10000000000 }', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', {
      number: 100000,
      bignumber: -10000000000,
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example6_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 7: Data { double=0.01171875, doubles=[0.01171875, 23, 4] }
  // [BUG] 除上述数组字段跳过 bug 外，此用例还触发 double 数组编码 bug：
  // sproto.ts 中 doubleToBinary/getDoubleHex 手动实现 IEEE 754 转换时，
  // 对 double 数组元素产生 undefined 值写入 buffer，导致编码结果错误。
  it('should encode example7: Data with double and doubles array', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', {
      double: 0.01171875,
      doubles: [0.01171875, 23, 4],
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example7_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });

  // Example 8: Data { fpn=1.82 }
  // fpn is integer(2), so 1.82 is multiplied by 100 -> 182 during encoding
  it('should encode example8: Data { fpn=1.82 } (fixed-point integer(2))', () => {
    const sp = loadPersonDataSproto();
    const encoded = sp.encode('Data', {
      fpn: 1.82,
    });
    expect(encoded).not.toBeNull();

    const expected = loadTestData('example8_encoded.bin');
    expect(hexdump(encoded!)).toBe(hexdump(expected));
  });
});

describe('encode - round-trip (decode then re-encode)', () => {
  // [BUG] 同上述编码回调 bug（sproto.ts ~L1491），re-encode 时缺失的数组字段未被跳过，
  // 导致编码结果字节与原始 C 生成的二进制不一致。
  // 其中 example7_encoded.bin 还额外受到以下两个 bug 影响：
  //   - decodeArray 缺少 SPROTO_TDOUBLE 分支（sproto.ts ~L1128），doubles 数组无法正确解码
  //   - doubleToBinary 编码 double 数组时产生 undefined 值
  const examples: Array<{ type: string; file: string }> = [
    { type: 'Person', file: 'example1_encoded.bin' },
    { type: 'Person', file: 'example2_encoded.bin' },
    { type: 'Data', file: 'example3_encoded.bin' },
    { type: 'Data', file: 'example4_encoded.bin' },
    { type: 'Data', file: 'example5_encoded.bin' },
    { type: 'Data', file: 'example6_encoded.bin' },
    { type: 'Data', file: 'example7_encoded.bin' },
    { type: 'Data', file: 'example8_encoded.bin' },
  ];

  for (const { type, file } of examples) {
    it(`should decode and re-encode ${file} to identical bytes`, () => {
      const sp = loadPersonDataSproto();
      const original = loadTestData(file);
      const decoded = sp.decode(type, original);
      expect(decoded).not.toBeNull();

      const reencoded = sp.encode(type, decoded!);
      expect(reencoded).not.toBeNull();
      expect(hexdump(reencoded!)).toBe(hexdump(original));
    });
  }
});

describe('encode - AddressBook (map type)', () => {
  // [BUG] 同上述编码回调 bug（sproto.ts ~L1491），AddressBook 编码也受影响。
  // 此外 AddressBook 的 person 字段为 map 类型 *Person(id)，涉及 mainindex 编码路径。
  it('should encode addressbook and match C fixture', () => {
    const sp = loadAddressBookSproto();
    const data = loadTestData('addressbook_encoded.bin');
    const decoded = sp.decode('AddressBook', data);
    expect(decoded).not.toBeNull();

    const reencoded = sp.encode('AddressBook', decoded!);
    expect(reencoded).not.toBeNull();
    expect(hexdump(reencoded!)).toBe(hexdump(data));
  });
});