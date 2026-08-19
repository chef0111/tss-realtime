import { describe, expect, test } from 'vitest';

import { applyEnvText } from '../env';

describe('applyEnvText', () => {
  test('sets missing keys and strips quotes', () => {
    const env: Record<string, string | undefined> = {};
    applyEnvText('# comment\nFOO=bar\nBAZ="quoted"\nQUX=\'also\'\n', env);
    expect(env.FOO).toBe('bar');
    expect(env.BAZ).toBe('quoted');
    expect(env.QUX).toBe('also');
  });

  test('does not override existing keys', () => {
    const env: Record<string, string | undefined> = { PORT: '4617' };
    applyEnvText('PORT=3331\nSECRET=x\n', env);
    expect(env.PORT).toBe('4617');
    expect(env.SECRET).toBe('x');
  });
});
