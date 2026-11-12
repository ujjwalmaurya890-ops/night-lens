import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetBrowserApi } from '../../src/adapters/browser';
import { installChromeMock } from './chromeMock';

beforeEach(() => { installChromeMock(); });
afterEach(() => {
  cleanup();
  // A new namespace object per test also invalidates the adapter cache; reset keeps it explicit.
  resetBrowserApi();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  for (const a of [...document.documentElement.attributes]) document.documentElement.removeAttribute(a.name);
  for (const a of [...document.body.attributes]) document.body.removeAttribute(a.name);
});
