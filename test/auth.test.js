const assert = require('node:assert/strict')
const { once } = require('node:events')
const { test } = require('node:test')
const express = require('express')
const session = require('express-session')
const { OAuth2 } = require('oauth')
const { expressGAuth } = require('..')

// Tests run sequentially because the middleware uses Passport's shared instance.
async function createApp(t, options = {}, google = {}) {
  // Stub only outbound Google requests so strategy, login and session handling
  // still exercise the installed dependencies.
  t.mock.method(OAuth2.prototype, '_request', (method, url, headers, body, token, done) => {
    if (url === 'https://www.googleapis.com/oauth2/v4/token') {
      done(null, JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        ...google.tokens
      }))
    } else if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
      done(null, JSON.stringify({
        sub: '123',
        name: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        hd: 'example.com',
        ...google.profile
      }))
    } else {
      done(new Error(`Unexpected OAuth request: ${method} ${url}`))
    }
  })

  const app = express()
  app.use(session({ secret: 'test-session-secret', resave: false, saveUninitialized: false }))
  app.use(expressGAuth({
    clientID: 'test-client',
    clientSecret: 'test-secret',
    clientDomain: 'http://localhost/callback',
    allowedDomains: ['example.com'],
    logger: { log() {}, error() {} },
    ...options
  }))
  app.use((req, res) => res.json({ user: req.user || null }))
  app.use((err, req, res, next) => res.status(500).send(err.message))

  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve())
    server.closeAllConnections()
  }))
  await once(server, 'listening')

  let cookie = ''
  return async function request(path) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      redirect: 'manual',
      headers: { cookie }
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    return response
  }
}

test('redirects anonymous users to Google with the configured OAuth parameters', async t => {
  const request = await createApp(t)
  const response = await request('/private')
  assert.equal(response.status, 302)
  const location = new URL(response.headers.get('location'))
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('client_id'), 'test-client')
  assert.equal(location.searchParams.get('redirect_uri'), 'http://localhost/callback')
  assert.equal(location.searchParams.get('scope'), 'profile email')
  assert.equal(location.searchParams.get('prompt'), 'select_account')
})

test('allows public endpoints without logging in', async t => {
  const request = await createApp(t, { publicEndPoints: ['/health'] })
  const response = await request('/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { user: null })
  assert.equal((await request('/health?check=1')).status, 302)
})

test('can ignore query parameters when matching public endpoints', async t => {
  const request = await createApp(t, {
    publicEndPoints: ['/health'],
    ignoreUrlParamsOfPublicEndPoints: true
  })
  assert.equal((await request('/health?check=1')).status, 200)
  assert.equal((await request('/private?check=1')).status, 302)
})

test('logs in an allowed domain and restores the user on the next request', async t => {
  const request = await createApp(t)
  const login = await request('/callback?code=test-code')
  assert.equal(login.status, 302)
  assert.equal(login.headers.get('location'), '/')
  const response = await request('/private')
  assert.equal(response.status, 200)
  const { user } = await response.json()
  assert.equal(user.id, '123')
  assert.equal(user.displayName, 'Test User')
  assert.equal(user.credentials.access_token, 'test-access-token')
  assert.equal(user.refreshToken, 'test-refresh-token')
})

test('allows an explicitly listed email without an allowed hosted domain', async t => {
  const request = await createApp(t, {
    allowedDomains: [],
    allowedEmails: ['test@example.com']
  }, { profile: { hd: undefined } })
  assert.equal((await request('/callback?code=test-code')).status, 302)
  assert.equal((await request('/private')).status, 200)
})

test('rejects users whose email suffix matches but hosted domain does not', async t => {
  const request = await createApp(t, {}, { profile: { hd: 'other.example' } })
  const response = await request('/callback?code=test-code')
  assert.match(await response.text(), /Login error, user not valid!/)
  assert.equal((await request('/private')).status, 302)
})

test('handles a denied Google authorization without logging the user in', async t => {
  const request = await createApp(t)
  const response = await request('/callback?error=access_denied')
  assert.match(await response.text(), /Error logging in, no user!/)
  assert.equal((await request('/private')).status, 302)
})

test('returns to the original URL after login regenerates the session', async t => {
  const request = await createApp(t, { returnToOriginalUrl: true })
  assert.equal((await request('/private?tab=details')).status, 302)
  const login = await request('/callback?code=test-code')
  assert.equal(login.status, 302)
  assert.equal(login.headers.get('location'), '/private?tab=details')
  assert.equal((await request('/private?tab=details')).status, 200)
})

test('requests consent again when an expired offline token has no refresh token', async t => {
  const request = await createApp(t, {
    googleAuthorizationParams: { scope: ['profile', 'email'], accessType: 'offline' }
  }, { tokens: { expires_in: -60, refresh_token: undefined } })
  assert.equal((await request('/callback?code=test-code')).status, 302)
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 60000 })
  const response = await request('/private')
  assert.equal(response.status, 302, await response.text())
  const location = new URL(response.headers.get('location'))
  assert.equal(location.origin, 'https://accounts.google.com')
  assert.equal(location.searchParams.get('prompt'), 'consent')
  assert.equal(location.searchParams.get('access_type'), 'offline')
})
