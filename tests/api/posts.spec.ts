import { test, expect } from '@playwright/test';

test.describe('posts', () => {
  test('GET /posts/1 returns a post', async ({ request }) => {
    const response = await request.get('/posts/1');

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: 1, userId: 1 });
    expect(typeof body.title).toBe('string');
  });

  test('POST /posts creates a post', async ({ request }) => {
    const payload = { title: 'foo', body: 'bar', userId: 1 };
    const response = await request.post('/posts', { data: payload });

    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject(payload);
  });
});
