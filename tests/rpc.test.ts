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
import { loadRpcSproto, loadTestData, loadSchemaBinary, sproto } from './helpers.js';

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
    const schema = loadSchemaBinary('protocol.spb');
    const sp = sproto.createNew(schema);
    if (!sp) {
      throw new Error('Failed to create sproto instance from protocol.spb');
    }
    return sp;
  }

  it('should create sproto instance from Uint8Array input', () => {
    // test.ts used Uint8Array; verify both number[] and Uint8Array work
    const schema = loadSchemaBinary('protocol.spb');
    const sp = sproto.createNew(schema);
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

// ============================================================================
// Additional Coverage: RPC error paths and edge cases
// ============================================================================
describe('RPC - error paths', () => {
  it('should throw when attaching with non-existent protocol name', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);
    expect(() => {
      request('nonexistent_protocol', { data: 'test' }, 1);
    }).toThrow('Protocol not found');
  });

  it('should throw when passing args to protocol with no request type (foo)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);
    // foo protocol has no request type, passing args should throw
    expect(() => {
      request('foo', { what: 'should fail' }, 1);
    }).toThrow('Request not found');
  });
});

// ============================================================================
// Additional Coverage: session storage (response vs true)
// ============================================================================
describe('RPC - session storage behavior', () => {
  it('should store response type for protocol with response (foobar)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // foobar has response type → session stores response object
    const session = 100;
    const req = request('foobar', { what: 'test' }, session);
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');

    // Send response and verify it decodes correctly
    const resp = result.responseFunc!({ ok: true });
    const respResult = host.dispatch(resp);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.result).toBeDefined();
    expect(respResult.result!.ok).toBe(true);
  });

  it('should store true for protocol with nil response (bar) and dispatch returns undefined result', () => {
    const sp = loadRpcSproto();
    const senderHost = sp.host('package');
    const senderRequest = senderHost.attach(sp);

    const receiverHost = sp.host('package');
    receiverHost.attach(sp);

    // bar has response=nil → session stores true
    const session = 200;
    const reqData = senderRequest('bar', null as any, session);

    const dispatchResult = receiverHost.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('bar');

    // Send confirm response
    const respData = dispatchResult.responseFunc!({});

    // Dispatch response - response === true means no response body
    const respResult = senderHost.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    // When response === true (no response type), result should be undefined
    expect(respResult.result).toBeUndefined();
  });

  it('should not store session for request without session parameter (blackhole)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // blackhole has no request and no response, send without session
    const req = request('blackhole', null as any);
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('blackhole');
    expect(result.responseFunc).toBeUndefined();
    expect(result.session).toBeUndefined();
  });
});

// ============================================================================
// Additional Coverage: dispatch with session=0 (no session request)
// ============================================================================
describe('RPC - dispatch with session edge cases', () => {
  it('should handle request with session=0 as no-session request', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // Session 0 should be treated as no session
    const req = request('foobar', { what: 'session-zero' }, 0);
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foobar');
    expect(result.result!.what).toBe('session-zero');
    // session=0 means no response expected
    expect(result.responseFunc).toBeUndefined();
  });

  it('should handle large session numbers', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    const session = 999999;
    const req = request('foobar', { what: 'large-session' }, session);
    const result = host.dispatch(req);
    expect(result.type).toBe('REQUEST');
    expect(result.session).toBe(session);

    const resp = result.responseFunc!({ ok: true });
    const respResult = host.dispatch(resp);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
  });
});

// ============================================================================
// Additional Coverage: confirm-only response dispatch on same host
// Covers L2069-2070 (session stores true) and L2143-2147 (response === true)
// ============================================================================
describe('RPC - confirm-only response dispatch on same host', () => {
  it('should dispatch confirm-only response on the same host that sent the request', () => {
    const sp = loadRpcSproto();
    const hostA = sp.host('package');
    const hostB = sp.host('package');

    const requestA = hostA.attach(sp);
    hostB.attach(sp);

    // bar protocol has response=nil → session stores true in hostA
    const session = 500;
    const reqData = requestA('bar', null as any, session);

    // hostB dispatches the request and gets responseFunc
    const dispatchResult = hostB.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('bar');
    expect(dispatchResult.responseFunc).toBeDefined();

    // Generate response data
    const respData = dispatchResult.responseFunc!({});

    // hostA dispatches the response → walks response === true branch
    const respResult = hostA.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    // When response === true (no response type), result should be undefined
    expect(respResult.result).toBeUndefined();
  });

  it('should dispatch confirm-only response for foobar (response !== true) on same host', () => {
    const sp = loadRpcSproto();
    const hostA = sp.host('package');
    const hostB = sp.host('package');

    const requestA = hostA.attach(sp);
    hostB.attach(sp);

    // foobar has response type → session stores response object (not true)
    const session = 501;
    const reqData = requestA('foobar', { what: 'test' }, session);

    const dispatchResult = hostB.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');

    const respData = dispatchResult.responseFunc!({ ok: true });

    // hostA dispatches the response → walks response !== true branch
    const respResult = hostA.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    expect(respResult.result).toBeDefined();
    expect(respResult.result!.ok).toBe(true);
  });
});

// ============================================================================
// Additional Coverage: foo protocol attach without request type
// Covers L2058-2059 (proto.request is null, skip encoding args)
// ============================================================================
describe('RPC - foo protocol attach without request type', () => {
  it('should send foo request without args (no request type)', () => {
    const sp = loadRpcSproto();
    const hostA = sp.host('package');
    const hostB = sp.host('package');

    const requestA = hostA.attach(sp);
    hostB.attach(sp);

    const session = 600;
    // foo has no request type, pass null as args
    const reqData = requestA('foo', null as any, session);

    const result = hostB.dispatch(reqData);
    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foo');
    // No request type means result is undefined
    expect(result.result).toBeUndefined();
  });
});

// ============================================================================
// Additional Coverage: bar confirm-only response dispatched on sender host
// Covers L2069-2070 (session stores true when proto.response is falsy)
// Covers L2114-2115 (response === true returns RESPONSE without result)
// ============================================================================
describe('RPC - bar confirm-only response on same host (L2069-2070, L2114-2115)', () => {
  it('should dispatch bar confirm response on sender host and get RESPONSE without result', () => {
    const sp = loadRpcSproto();

    // Use a single sender host that both sends and receives
    const senderHost = sp.host('package');
    const senderRequest = senderHost.attach(sp);

    // Separate receiver host to dispatch the request and generate response
    const receiverHost = sp.host('package');
    receiverHost.attach(sp);

    const session = 700;
    // bar protocol: no request type, response=nil (confirm-only)
    // L2069-2070: proto.response is falsy → session[700] = true
    const reqData = senderRequest('bar', null as any, session);

    // Receiver dispatches the request
    const dispatchResult = receiverHost.dispatch(reqData);
    expect(dispatchResult.type).toBe('REQUEST');
    expect(dispatchResult.pname).toBe('bar');
    expect(dispatchResult.responseFunc).toBeDefined();

    // Receiver generates confirm response (no body)
    const respData = dispatchResult.responseFunc!({});

    // L2114-2115: sender dispatches the response on its own host
    // session[700] === true → returns { type: "RESPONSE", session: 700 } without result
    const respResult = senderHost.dispatch(respData);
    expect(respResult.type).toBe('RESPONSE');
    expect(respResult.session).toBe(session);
    expect(respResult.result).toBeUndefined();
  });

  it('should dispatch blackhole request without session (L2078-2079 else branch)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // blackhole: no request, no response; send without session
    // L2078-2079: headerData.session is falsy → returns REQUEST without responseFunc
    const reqData = request('blackhole', null as any);
    const result = host.dispatch(reqData);

    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('blackhole');
    expect(result.responseFunc).toBeUndefined();
    expect(result.session).toBeUndefined();
  });

  it('should dispatch foobar request with session=0 (falsy session, L2078-2079)', () => {
    const sp = loadRpcSproto();
    const host = sp.host('package');
    const request = host.attach(sp);

    // session=0 is falsy in JS → should hit L2078-2079 else branch
    const reqData = request('foobar', { what: 'zero-session' }, 0);
    const result = host.dispatch(reqData);

    expect(result.type).toBe('REQUEST');
    expect(result.pname).toBe('foobar');
    expect(result.result).toBeDefined();
    expect(result.result!.what).toBe('zero-session');
    // session=0 is falsy, so no responseFunc
    expect(result.responseFunc).toBeUndefined();
  });
});
