import test from 'node:test'
import assert from 'node:assert/strict'

// Companion to create_api_app.auth_removed_owner.test.ts: same audit finding
// (AUTH-001), but asserts the positive case (a still-configured owner keeps
// owner privilege). Kept in its own file because CONFIG (config.ts) reads
// process.env exactly once per process, so this needs its own process/module
// instance with a different OWNER_USER_IDS value.
process.env.OWNER_USER_IDS = 'current-owner'
process.env.DISCORD_CLIENT_ID = 'x'
process.env.DISCORD_CLIENT_SECRET = 'x'
process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/x'
process.env.INTERNAL_API_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
process.env.NODE_ENV = 'production'

test('a still-configured owner keeps owner privilege through refresh', async () => {
  const { createApiApp } = await import('./create_api_app')
  const { app } = createApiApp()
  await app.ready()

  try {
    const token = app.jwt.sign(
      {
        userId: 'current-owner',
        username: 'x',
        discriminator: '0000',
        avatar: null,
        guilds: [],
        guildsData: [],
        isOwner: false,
      },
      { expiresIn: '1h' }
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(response.statusCode, 200)

    const set_cookie = response.headers['set-cookie']
    const cookie_header = Array.isArray(set_cookie) ? set_cookie[0] : set_cookie
    const new_token = cookie_header?.match(/yuebot_token=([^;]+)/)?.[1]
    const decoded = app.jwt.decode(new_token as string) as { isOwner?: boolean } | null

    assert.equal(decoded?.isOwner, true)
  } finally {
    await app.close()
  }
})
