const _ = require('lodash')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy

module.exports = function expressGAuth(options) {
  const defaults = {
    allowedDomains: [],
    publicEndPoints: [],
    logger: console,
    unauthorizedUser: (req, res, next, user) => res.send(`<h1>Login error, user not valid!</h1><h2>${user.displayName} ${JSON.stringify(user.emails)}</h2>`),
    errorPassportAuth: (req, res, next, err) => res.send('<h1>Error logging in!</h1>'),
    errorNoUser: (req, res, next) => res.send('<h1>Error logging in, no user!</h1>'),
    errorLogin: (req, res, next, err) => res.send('<h1>Login error!</h1>'),
    serializeUser: (user, done) => done(null, user),
    deserializeUser: (user, done) => done(null, user)
  }
  const config = Object.assign(defaults, options)
  const app = config.clientExpressApp

  passport.use(new GoogleStrategy({
      clientID: config.clientID,
      clientSecret: config.clientSecret,
      callbackURL: config.clientDomain
    }, function(accessToken, refreshToken, profile, cb) {
      cb(null, profile, accessToken, refreshToken)
    }
  ))
  passport.serializeUser(config.serializeUser)
  passport.deserializeUser(config.deserializeUser)

  app.use(passport.initialize())
  app.use(passport.session())
  app.use(function expressGAuthMiddleware(req, res, next) {
    if (req.user || config.publicEndPoints.includes(req.originalUrl)) {
      next()
    } else {
      if (!req.session.returnTo) {
        req.session.returnTo = req.originalUrl
      }
      passport.authenticate('google', {scope: ['profile', 'email']}, function(err, user, info) {
        if (err) {
          config.logger.error('GAuth error', err)
          config.errorPassportAuth(req, res, next, err)
        } else if (!user) {
          config.logger.log('GAuth no user', info)
          config.errorNoUser(req, res, next)
        } else if (allowedUser(user, config)) {
          req.logIn(user, function(err) {
            if (err) {
              config.logger.error('Login error', err)
              config.errorLogin(req, res, next, err)
            } else {
              const redirect = req.session.returnTo
              delete req.session.returnTo
              res.redirect(redirect)
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

function allowedUser(user, config) {
  if (user.emails) {
    const userDomains = user.emails.map(function(email) {
      return email.value && email.value.includes('@') ? email.value.split('@')[1] : null
    })
    return _.intersection(userDomains, config.allowedDomains).length > 0
  } else {
    return false
  }
}
