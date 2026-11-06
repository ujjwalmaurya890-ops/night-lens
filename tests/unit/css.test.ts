import { describe, expect, it } from 'vitest';
import { sanitizeCustomCss } from '../../src/shared/css';
import { sanitizeSettings } from '../../src/shared/storage';
import { cloneDefaults } from '../../src/shared/defaults';

describe('sanitizeCustomCss (privacy: no external network requests via injected CSS)', () => {
  it('keeps ordinary CSS', () => {
    expect(sanitizeCustomCss('body { letter-spacing: 0.02em; } .x { color: #fff }')).toBe('body { letter-spacing: 0.02em; } .x { color: #fff }');
  });
  it('blocks remote url() references (would leak a network request from the page)', () => {
    expect(sanitizeCustomCss('body { background-image: url(https://evil.example/x.png); }')).toBe('');
    expect(sanitizeCustomCss("a { background: url('http://x.test') }")).toBe('');
    expect(sanitizeCustomCss('a { background: url(//x.test/y) }')).toBe('');
  });
  it('allows inline data: URLs and in-document fragment refs', () => {
    expect(sanitizeCustomCss('svg { fill: url(#grad) }')).toContain('url(#grad)');
    expect(sanitizeCustomCss('body { background-image: url("data:image/png;base64,AAAA") }')).toContain('data:');
  });
  it('blocks javascript:, expression(), @import, @font-face and behavior/-moz-binding', () => {
    expect(sanitizeCustomCss('a { background: javascript:alert(1) }')).toBe('');
    expect(sanitizeCustomCss('a { width: expression(alert(1)) }')).toBe('');
    expect(sanitizeCustomCss('@import url("https://fonts.example/x.css");')).toBe('');
    expect(sanitizeCustomCss('@font-face { src: url(https://x.test/f.woff2) }')).toBe('');
    expect(sanitizeCustomCss('a { behavior: url(x.htc) }')).toBe('');
  });
  it('rejects comment/escape obfuscation and non-image data URLs', () => {
    expect(sanitizeCustomCss('a{background:u\\72l(https://x.test)}')).toBe('');
    expect(sanitizeCustomCss('a{background:url(/*x*/https://x.test)}')).toBe('');
    expect(sanitizeCustomCss('a{background:url(data:text/html;base64,AAAA)}')).toBe('');
    expect(sanitizeCustomCss('@\\69mport "https://x.test/x.css";')).toBe('');
  });
  it('rejects empty and oversized input', () => {
    expect(sanitizeCustomCss('')).toBe('');
    expect(sanitizeCustomCss('   ')).toBe('');
    expect(sanitizeCustomCss('a{color:red}'.repeat(5000))).toBe('');
  });
});

describe('sanitizeSettings custom CSS hardening', () => {
  it('drops stored custom CSS that references remote URLs, keeps safe CSS', () => {
    const s = sanitizeSettings({ ...cloneDefaults(), customCSS: { 'a.com': 'body{color:#fff}', 'b.com': 'body{background:url(https://x.test/p.png)}' } });
    expect(s.customCSS).toEqual({ 'a.com': 'body{color:#fff}' });
  });
});
