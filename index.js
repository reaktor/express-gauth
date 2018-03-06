const addSeconds = require('date-fns/add_seconds')

module.exports = function expressGAuth(options) {
  const passport = require('passport')
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
    googleAuthorizationParams: {
      scope: ['profile', 'email'],
      prompt: 'select_account'
    }
  }
  const config = Object.assign(defaults, options)
  const strategy = new GoogleStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.clientDomain
  }, function(accessToken, refreshToken, params, profile, cb) {
    if (refreshToken) {
      profile.refreshToken = refreshToken
      profile.tokenExpirationTime = addSeconds(Date(), params.expires_in)
    }
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
            const isExpired = refreshToken && isAfter(now, tokenExpirationTime)

            if (refreshToken && isExpired) {
              refresh.requestNewAccessToken('google', refreshToken,
                updateAccessTokenCallback(req.session, next))
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
              req.session.returnTo = req.originalUrl
            }
            passport.authenticate('google',
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
              })(req, res, next)
          }
        })
      }
    })
  }
}

function updateAccessTokenCallback(session, next) {
  return (err, accessToken, refreshToken) => {
    if (err) {
      next(err)
    } else {
      const user = session.passport.user
      const expiresInSeconds = user.credentials.expires_in
      user.credentials.access_token = accessToken
      user.tokenExpirationTime = addSeconds(Date(), expiresInSeconds)
      next()
    }
  }
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
