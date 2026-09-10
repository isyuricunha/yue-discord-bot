import test from 'node:test'
import assert from 'node:assert/strict'

// Regression coverage for audit finding AUTH-001: a stale isOwner:true JWT
// claim must not survive an operator removing that user from OWNER_USER_IDS.
// The fix lives in the authenticate decorator (create_api_app.ts), which
// rederives isOwner from the live config on every authenticated request, and
// in /auth/refresh, which recomputes the claim instead of copying the old
// payload.
//
// OWNER_USER_IDS must be set before CONFIG is imported anywhere in this
// process: CONFIG (config.ts) reads process.env exactly once, at module
// import time, so it is set here as the very first statement in a file that
// is not imported by any other test file. It is deliberately kept empty for
// this file: this test asserts that removal (no configured owners) revokes
// owner privilege.
process.env.OWNER_USER_IDS = ''
process.env.DISCORD_CLIENT_ID = 'x'
process.env.DISCORD_CLIENT_SECRET = 'x'
process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/x'
process.env.INTERNAL_API_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
process.env.NODE_ENV = 'production'

test('a former owner cannot refresh a still-owner JWT after removal from OWNER_USER_IDS', async () => {
  const { createApiApp } = await import('./create_api_app')
  const { app } = createApiApp()
  await app.ready()

  try {
    const stale_token = app.jwt.sign(
      {
        userId: 'former-owner',
        username: 'x',
        discriminator: '0000',
        avatar: null,
        guilds: ['guild-1'],
        guildsData: [],
        isOwner: true,
      },
      { expiresIn: '1h' }
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { authorization: `Bearer ${stale_token}` },
    })

    assert.equal(response.statusCode, 200)

    const set_cookie = response.headers['set-cookie']
    const cookie_header = Array.isArray(set_cookie) ? set_cookie[0] : set_cookie
    const new_token = cookie_header?.match(/yuebot_token=([^;]+)/)?.[1]
    assert.ok(new_token, 'refresh must set a new session cookie')

    const decoded = app.jwt.decode(new_token as string) as { isOwner?: boolean } | null
    assert.equal(decoded?.isOwner, false)

    // /me must reflect the rederived value on any subsequent authenticated
    // request too, not only immediately after refresh.
    const me_response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${stale_token}` },
    })
    assert.equal(me_response.json().isOwner, false)
  } finally {
    await app.close()
  }
})
