const addSeconds = require('date-fns/add_seconds')
const passport = require('passport')
const url = require("url")

module.exports = function expressGAuth(options) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy
  const refresh = require('passport-oauth2-refresh')
  const isAfter = require('date-fns/is_after')

  const defaults = {
    allowedDomains: [],
    allowedEmails: [],
    publicEndPoints: [],
    logger: console,
    unauthorizedUser: (req, res, next, user) => res.send(`<h1>Login error, user not valid!</h1><h2>${user.displayName} ${JSON.stringify(user.emails)}</h2>`),
    errorPassportAuth: (req, res, next, err) => res.send('<h1>Error logging in!</h1>'),
    errorNoUser: (req, res, next) => res.send('<h1>Error logging in, no user!</h1>'),
    errorLogin: (req, res, next, err) => res.send('<h1>Login error!</h1>'),
    serializeUser: (user, done) => done(null, user),
    deserializeUser: (user, done) => done(null, user),
    returnToOriginalUrl: false,
    isReturnUrlAllowed: url => /\.(css|jpe?g|gif|ico|js|json|png|svg|woff2?)$/i.test(url) === false,
    googleAuthorizationParams: {
      scope: ['profile', 'email'],
      prompt: 'select_account'
    },
    refreshBefore: 10
  }
  const config = Object.assign(defaults, options)
  const strategy = new GoogleStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.clientDomain
  }, function(accessToken, refreshToken, params, profile, cb) {
    profile.refreshToken = refreshToken
    profile.tokenExpirationTime = calculateExpirationTime(params.expires_in,
      config.refreshBefore)
    profile.credentials = params // inject authorization info (tokens, token type, expires_in) to profile

    cb(null, profile, accessToken, refreshToken)
  })

  passport.use(strategy)
  refresh.use(strategy)

  passport.serializeUser(config.serializeUser)
  passport.deserializeUser(config.deserializeUser)

  const passportInitialize = passport.initialize()
  const passportSession = passport.session()
  return function expressGAuthMiddleware(req, res, next) {
    passportInitialize(req, res, err => {
      if (err) {
        next(err)
      } else {
        passportSession(req, res, err => {
          if (err) {
            next(err)
          } else if (req.user) {
            const { tokenExpirationTime, refreshToken } = req.user
            const now = Date()
            const isExpired = isAfter(now, tokenExpirationTime)
            const shouldBeRefreshed = isExpired &&
              config.googleAuthorizationParams.accessType === 'offline'

            if (shouldBeRefreshed && refreshToken) {
              refresh.requestNewAccessToken('google', refreshToken,
              updateAccessTokenCallback(config, req.session, next))
            } else if (shouldBeRefreshed) {
              // Access token needs to be updated, but we are missing refresh
              // token required to do it. Google provides refresh token only
              // when authorizing the user through consent screen, so we
              // reauthenticate the user and ask for their consent again in
              // order to gain refresh token
              const { googleAuthorizationParams } = config
              const newGoogleParams = Object.assign(
                {},
                googleAuthorizationParams,
                { prompt: 'consent' }
              )
              const newConfig = Object.assign(
                {},
                config,
                { googleAuthorizationParams: newGoogleParams
              })
              req.logOut()
              authenticate(newConfig, req, res, next)(req, res, next)
            } else {
              next()
            }
          } else if (config.publicEndPoints.includes(req.originalUrl)) {
            next()
          } else {
            // `code` in query params would mean user was redirected back from
            // google and we don't want to save that url to returnTo. This is
            // is an issue because we don't have separate end point for
            // redirect_uri as callback for oauth2
            if (config.returnToOriginalUrl && req.query.code == null) {
              saveReturnUrlToSession(req, config.isReturnUrlAllowed)
            }
            authenticate(config, req, res, next)(req, res, next)
          }
        })
      }
    })
  }
}

function updateAccessTokenCallback(config, session, next) {
  return (err, accessToken, refreshToken) => {
    if (err) {
      config.logger.error(err)
      next({ message: 'Error when attempting to refresh Google Access Token',
        original_error: err})
    } else {
      const user = session.passport.user
      const expiresInSeconds = user.credentials.expires_in
      user.credentials.access_token = accessToken
      user.tokenExpirationTime = calculateExpirationTime(expiresInSeconds, config.refreshBefore)
      next()
    }
  }
}

function authenticate(config, req, res, next) {
  return passport.authenticate('google',
    config.googleAuthorizationParams,
    (err, user, info) => {
      if (err) {
        config.logger.error('GAuth error', err)
        config.errorPassportAuth(req, res, next, err)
      } else if (!user) {
        config.logger.log('GAuth no user', info)
        config.errorNoUser(req, res, next)
      } else if (allowedUser(user, config)) {
        req.logIn(user, (err) => {
          if (err) {
            config.logger.error('Login error', err)
            config.errorLogin(req, res, next, err)
          } else {
            res.redirect(req.session.returnTo || '/')
            delete req.session.returnTo
          }
        })
      } else {
        config.logger.log('User not valid', user.displayName, user.emails)
        config.unauthorizedUser(req, res, next, user)
      }
    })
}

function calculateExpirationTime(expiresInSeconds, refreshBefore) {
  const refreshAfter = Math.max(expiresInSeconds - refreshBefore, 0)
  return addSeconds(Date(), refreshAfter)
}

function allowedUser(user, config) {
  if (user.emails) {
    const userEmails = user.emails.map(email => email.value)
    const userDomains = userEmails.map(email => {
      return email && email.includes('@') ? email.split('@').slice(-1)[0] : null
    })
    return config.allowedDomains.some(d => userDomains.includes(d))
      || config.allowedEmails.some(e => userEmails.includes(e))
  } else {
    return false
  }
}

// Browser might try to fetch assets already before the "main request"
// reaches our server. We must tell apart these locations from where
// the user really tries to go. Also, we should set returnTo only once
// per session.
function saveReturnUrlToSession(req, isReturnUrlAllowed) {
  const referrer = req.get("referrer")
  const isInternalRequest = Boolean(
    referrer && url.parse(referrer).hostname === req.hostname
  )

  const isUrlAllowed = isReturnUrlAllowed(req.originalUrl)
  const isSessionSet = Boolean(req.session && req.session.returnTo)

  if (!isUrlAllowed || isInternalRequest || isSessionSet) {
    return
  }

  req.session.returnTo = req.originalUrl
}