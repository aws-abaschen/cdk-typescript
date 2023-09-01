import { handler } from './index'
import { expect, test } from '@jest/globals';

test('lambda return 200', async () => {
    const result = await handler();
    expect(result).toMatchObject({ status: "200" });
  });