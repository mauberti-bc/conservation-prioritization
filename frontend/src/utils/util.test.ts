import { describe, expect, it } from 'vitest';
import { ensureProtocol } from './util';

describe('ensureProtocol', () => {
  it('uses http for local development hosts without a protocol', () => {
    expect(ensureProtocol('localhost:3000/api')).toBe('http://localhost:3000/api');
    expect(ensureProtocol('host.docker.internal:4200')).toBe('http://host.docker.internal:4200');
  });

  it('keeps http for local development hosts', () => {
    expect(ensureProtocol('http://localhost:3000')).toBe('http://localhost:3000');
    expect(ensureProtocol('http://host.docker.internal/api')).toBe('http://host.docker.internal/api');
  });

  it('upgrades http for hosts that only begin with a local development hostname', () => {
    expect(ensureProtocol('http://localhost.example.com')).toBe('https://localhost.example.com');
    expect(ensureProtocol('http://host.docker.internal.example.com/api')).toBe(
      'https://host.docker.internal.example.com/api'
    );
    expect(ensureProtocol('localhost.example.com')).toBe('https://localhost.example.com');
  });

  it('keeps https urls unchanged', () => {
    expect(ensureProtocol('https://example.com')).toBe('https://example.com');
  });

  it('adds the requested protocol to other hosts', () => {
    expect(ensureProtocol('example.com')).toBe('https://example.com');
    expect(ensureProtocol('example.com', 'http://')).toBe('http://example.com');
    expect(ensureProtocol('http://example.com', 'http://')).toBe('http://example.com');
    expect(ensureProtocol('http://example.com')).toBe('https://example.com');
  });
});
