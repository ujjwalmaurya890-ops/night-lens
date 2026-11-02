import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { installChromeMock } from './chromeMock';

beforeEach(() => { installChromeMock(); });
afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  for (const a of [...document.documentElement.attributes]) document.documentElement.removeAttribute(a.name);
  for (const a of [...document.body.attributes]) document.body.removeAttribute(a.name);
});
