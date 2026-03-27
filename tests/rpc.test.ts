/**
 * RPC tests for sproto host/attach/dispatch functionality.
 *
 * Tests cover:
 * - Host creation
 * - Request encoding and dispatching
 * - Response encoding and decoding
 * - Request/Response round-trip
 * - Various protocol configurations
 *
 * Reference: sproto-rust/tests/rpc_tests.rs
 */
import { describe, it, expect } from 'vitest';
import { loadRpcSproto, loadTestData, sproto } from './helpers.js';

describe('RPC - host creation', () => {
  it('should create a host with valid package name', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    expect(host).toBeDefined();
  });

  it('should create a host with default package name', () => {
    const sp = loadRpcSproto();
    // Default package name is "package" in the JS implementation
    const host = sp.host();
    expect(host).toBeDefined();
  });
});

describe('RPC - protocol query', () => {
  it('should query foobar protocol', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto('foobar');
    expect(proto).not.toBeNull();
    expect(proto!.tag).toBe(1);
    expect(proto!.name).toBe('foobar');
    expect(proto!.request).not.toBeNull();
    expect(proto!.response).not.toBeNull();
  });

  it('should query foo protocol (response only)', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto('foo');
    expect(proto).not.toBeNull();
    expect(proto!.tag).toBe(2);
    // foo has no request type, only response
    expect(proto!.request).toBeNull();
    expect(proto!.response).not.toBeNull();
  });

  it('should query bar protocol (response nil / confirm)', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto('bar');
    expect(proto).not.toBeNull();
    expect(proto!.tag).toBe(3);
  });

  it('should query blackhole protocol (no request, no response)', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto('blackhole');
    expect(proto).not.toBeNull();
    expect(proto!.tag).toBe(4);
    expect(proto!.request).toBeNull();
    expect(proto!.response).toBeNull();
  });

  it('should return null for nonexistent protocol', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto('nonexistent');
    expect(proto).toBeNull();
  });

  it('should query protocol by tag number', () => {
    const sp = loadRpcSproto();
    const proto = sp.queryproto(1);
    expect(proto).not.toBeNull();
    expect(proto!.name).toBe('foobar');
  });
});

describe('RPC - request/response round-trip', () => {
  it('should round-trip foobar request with response', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // Client sends foobar request
    const session = 1;
    const req = request('foobar', { what: 'hello' }, session);
    expect(req).toBeDefined();
    expect(req.length).toBeGreaterThan(0);

    // Server dispatches request
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foobar');
    expect(result.result).toBeDefined();
    expect(result.result!.what).toBe('hello');
    expect(result.session).toBe(session);
    expect(result.responseFunc).toBeDefined();

    // Server sends response
    const resp = result.responseFunc!({ ok: true });
    expect(resp).toBeDefined();
    expect(resp.length).toBeGreaterThan(0);

    // Client dispatches response
    const respResult = host.dispatch(resp);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    expect(respResult.result).toBeDefined();
    expect(respResult.result!.ok).toBe(true);
  });

  it('should round-trip request without session (one-way)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // Send request without session
    const req = request('foobar', { what: 'fire-and-forget' });
    expect(req).toBeDefined();

    // Dispatch
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foobar');
    expect(result.result!.what).toBe('fire-and-forget');
    // No session means no response function
    expect(result.responseFunc).toBeUndefined();
  });

  it('should handle multiple sequential requests', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // Send multiple requests
    for (let i = 1; i <= 5; i++) {
      const req = request('foobar', { what: `msg-${i}` }, i);
      const result = host.dispatch(req);
      expect(result.type).toBe('REQUEST');
      expect(result.pname).toBe('foobar');
      expect(result.result!.what).toBe(`msg-${i}`);
      expect(result.session).toBe(i);

      // Send response
      const resp = result.responseFunc!({ ok: true });
      const respResult = host.dispatch(resp);
      expect(respResult.type).toBe('RESPONSE');
      expect(respResult.session).toBe(i);
      expect(respResult.result!.ok).toBe(true);
    }
  });
});

describe('RPC - dispatch C-generated fixtures', () => {
  it('should dispatch foobar request from C fixture', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    // Need to attach to enable response handling
    host.attach(sp);

    const reqData = loadTestData('rpc_foobar_request.bin');

    // The fixture is already packed, dispatch it directly
    const result = host.dispatch(reqData);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foobar');
    expect(result.result).toBeDefined();
    expect(result.result!.what).toBe('hello');
  });
});

describe('RPC - unicode and special values', () => {
  it('should handle unicode in request data', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    const unicodeStr = 'Hello \u4e16\u754c!';
    const req = request('foobar', { what: unicodeStr }, 1);
    const result = host.dispatch(req);
    expect(result.result!.what).toBe(unicodeStr);
  });

  it('should handle empty string in request', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    const req = request('foobar', { what: '' }, 1);
    const result = host.dispatch(req);
    expect(result.result!.what).toBe('');
  });

  it('should handle response with boolean values', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    const session = 42;
    const req = request('foobar', { what: 'test' }, session);
    const result = host.dispatch(req);

    // Test response with ok=false
    const resp = result.responseFunc!({ ok: false });
    const respResult = host.dispatch(resp);
    expect(respResult.result!.ok).toBe(false);
  });
});

describe('RPC - response dispatch', () => {
  it('should dispatch response with data back to sender', () => {
    const sp = loadRpcSproto();
    // Sender side: create host and attach
    const senderHost = sp.host('package');
    const senderRequest = senderHost.attach(sp);

    // Receiver side: create host and attach
    const receiverHost = sp.host('package');
    receiverHost.attach(sp);

    // Sender sends a foobar request
    const session = 10;
    const reqData = senderRequest('foobar', { what: 'ping' }, session);

    // Receiver dispatches the request
    const dispatchResult = receiverHost.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('foobar');
    expect(dispatchResult.responseFunc).toBeDefined();

    // Receiver sends response
    const respData = dispatchResult.responseFunc!({ ok: true });

    // Sender dispatches the response
    const respResult = senderHost.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    expect(respResult.result).toBeDefined();
    expect(respResult.result!.ok).toBe(true);
  });

  it('should dispatch response for bar protocol (response nil / confirm)', () => {
    const sp = loadRpcSproto();
    const senderHost = sp.host('package');
    const senderRequest = senderHost.attach(sp);

    const receiverHost = sp.host('package');
    receiverHost.attach(sp);

    // bar has response=nil, meaning confirm-only (no response body)
    const session = 20;
    const reqData = senderRequest('bar', null as any, session);

    const dispatchResult = receiverHost.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('bar');

    // Receiver sends confirm response (no body)
    const respData = dispatchResult.responseFunc!({});

    // Sender dispatches the confirm response
    const respResult = senderHost.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    // bar response is nil, so result should be undefined
    expect(respResult.result).toBeUndefined();
  });

  it('should dispatch request without session (one-way, no response expected)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // Send blackhole request without session
    const reqData = request('blackhole', null as any);
    const result = host.dispatch(reqData);

    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('blackhole');
    // No session means no responseFunc
    expect(result.responseFunc).toBeUndefined();
    expect(result.session).toBeUndefined();
  });

  it('should dispatch foo request (response-only protocol with no request type)', () => {
    const sp = loadRpcSproto();
    const senderHost = sp.host('package');
    const senderRequest = senderHost.attach(sp);

    const receiverHost = sp.host('package');
    receiverHost.attach(sp);

    // foo has no request type, only response
    const session = 30;
    const reqData = senderRequest('foo', null as any, session);

    const dispatchResult = receiverHost.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('foo');

    // Receiver sends response with ok=true
    const respData = dispatchResult.responseFunc!({ ok: true });

    const respResult = senderHost.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    expect(respResult.result!.ok).toBe(true);
  });

  it('should handle genResponse without response body', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    host.attach(sp);
    const request = host.attach(sp);

    // bar protocol: response nil
    const session = 40;
    const reqData = request('bar', null as any, session);
    const dispatchResult = host.dispatch(reqData);

    // genResponse for bar should work even without args
    const respData = dispatchResult.responseFunc!({});
    expect(respData).toBeDefined();
    expect(Array.isArray(respData)).toBe(true);
  });
});

describe('RPC - real protocol bundle (protocol.spb)', () => {
  // Migrated from test.ts: tests with the actual project protocol bundle

  function loadProtocolSproto() {
    const schema = loadTestData('protocol.spb');
    const sp = sproto.createNew(schema);
    if (!sp) {
      throw new Error('Failed to create sproto instance from protocol.spb');
    }
    return sp;
  }

  it('should create sproto instance from Uint8Array input', () => {
    // test.ts used Uint8Array; verify both number[] and Uint8Array work
    const raw = loadTestData('protocol.spb');
    const uint8 = new Uint8Array(raw);
    const sp = sproto.createNew(uint8 as any);
    expect(sp).not.toBeNull();
  });

  it('should create host with custom package name', () => {
    const sp = loadProtocolSproto();
    const host = sp.host('base.package');
    expect(host).toBeDefined();
  });

  it('should build and dispatch login request with long string and nested struct', () => {
    const sp = loadProtocolSproto();
    const client = sp.host('base.package');
    const clientRequest = client.attach(sp);

    const data = {
      token: 'testtestxxxxxxxxxxxxxxxxxxxxxxxxxxttttttttttttttttttttttttttttttttttesttestxxxxxxxxxxxxxxxxxxxxxxxxxxttttttttttttttttttttttttttttttttt',
      ctx: {
        proto_checksum: 'xxxxx',
      },
    };

    const req = clientRequest('login.login', data);
    expect(req).toBeDefined();
    expect(Array.isArray(req)).toBe(true);
    expect(req.length).toBeGreaterThan(0);

    const ret = client.dispatch(req);
    expect(ret).toBeDefined();
    expect(ret.type).toBe('REQUEST');
    expect(ret.pname).toBe('login.login');
    expect(ret.result).toBeDefined();
    expect(ret.result!.token).toBe(data.token);
    expect((ret.result!.ctx as any).proto_checksum).toBe('xxxxx');
  });

  it('should build request without session (one-way)', () => {
    const sp = loadProtocolSproto();
    const client = sp.host('base.package');
    const clientRequest = client.attach(sp);

    const data = {
      token: 'short',
      ctx: { proto_checksum: 'abc' },
    };

    // No session parameter
    const req = clientRequest('login.login', data);
    expect(req).toBeDefined();

    const ret = client.dispatch(req);
    expect(ret.type).toBe('REQUEST');
    expect(ret.pname).toBe('login.login');
    // No session means no responseFunc
    expect(ret.responseFunc).toBeUndefined();
  });
});
