import { describe, expect, it } from 'vitest';
import { usernameSchema } from './protocol.js';

describe('usernameSchema', () => {
  it.each(['Anna', 'Ann1', 'Spieler_12', 'Max-Müller', 'éowyn'])('accepts the valid username %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it.each(['', 'A1', 'Ab_12', '123_--', 'Anna Maria', 'Anna!', '12345678901234567'])('rejects the invalid username %s', (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });
});
