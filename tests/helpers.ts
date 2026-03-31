import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sproto from '../src/sproto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTDATA_DIR = path.join(__dirname, 'testdata');

/**
 * Load a binary test data file and return as number[].
 */
export function loadTestData(name: string): number[] {
  const filePath = path.join(TESTDATA_DIR, name);
  const buf = fs.readFileSync(filePath);
  return Array.from(new Uint8Array(buf));
}

/**
 * Load a schema binary file and return as Uint8Array (required by createNew).
 */
export function loadSchemaBinary(name: string): Uint8Array {
  const filePath = path.join(TESTDATA_DIR, name);
  const buf = fs.readFileSync(filePath);
  return new Uint8Array(buf);
}

/**
 * Convert a number[] to a hex dump string for readable assertion messages.
 */
export function hexdump(data: number[]): string {
  return data.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Load the Person/Data schema and create a sproto instance.
 */
export function loadPersonDataSproto() {
  const schema = loadSchemaBinary('person_data_schema.bin');
  const sp = sproto.createNew(schema);
  if (!sp) {
    throw new Error('Failed to create sproto instance from person_data_schema.bin');
  }
  return sp;
}

/**
 * Load the AddressBook schema and create a sproto instance.
 */
export function loadAddressBookSproto() {
  const schema = loadSchemaBinary('addressbook_schema.bin');
  const sp = sproto.createNew(schema);
  if (!sp) {
    throw new Error('Failed to create sproto instance from addressbook_schema.bin');
  }
  return sp;
}

/**
 * Load the RPC schema and create a sproto instance.
 */
export function loadRpcSproto() {
  const schema = loadSchemaBinary('rpc_schema.bin');
  const sp = sproto.createNew(schema);
  if (!sp) {
    throw new Error('Failed to create sproto instance from rpc_schema.bin');
  }
  return sp;
}

export { sproto };
