import { test, expect } from 'vitest';
import sum from './http-eval';
test('sums two numbers', () => {
  expect(sum(4, 7)).toBe(11);
});
