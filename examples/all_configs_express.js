const express = require('express')
const session = require('express-session')
const gauth = require('../index.js')
const app = express()
const logoutEndPoint = '/logout'
// Initialize Google auth. You need your Google app id and secret.
const myGauth = gauth({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  clientDomain: 'http://localhost:5555',
  allowedDomains: ['reaktor.fi', 'reaktor.com'], // User needs to login with Google and email with these domains.
  allowedEmails: ['john@example.com', 'jussi@example.com'], // These users are allowed login through Google auth.
  publicEndPoints: [logoutEndPoint], // These end points do not require any authentication.
  clientExpressApp: app,
  unauthorizedUser: (req, res, next, user) => res.send(`<h1>Sorry ${user.displayName}, you has no access!</h1>`),
  errorPassportAuth: (req, res, next, err) => res.send('<h1>Error logging in!</h1>'),
  errorNoUser: (req, res, next) => res.send('<h1>Error logging in, no user details!</h1>'),
  errorLogin: (req, res, next, err) => res.send('<h1>Login error in Express, this is odd!</h1>'),
  serializeUser: (user, done) => done(null, user),
  deserializeUser: (user, done) => done(null, user),
  logger: {
    log: function() {
      console.log('mylog', new Date, JSON.stringify(arguments))
    },
    error: function() {
      console.log('myerror', new Date, JSON.stringify(arguments))
    }
  },
  // Override default authorization params
  // List of supported params are available in passport-google-oauth2 source
  // https://github.com/jaredhanson/passport-google-oauth2/blob/master/lib/strategy.js
  // https://developers.google.com/identity/protocols/OpenIDConnect#authenticationuriparameters
  googleAuthorizationParams: {
    scope: ['profile', 'email'],
    hostedDomain: 'reaktor.fi'
  },
  // Redirect user to the original url
  returnToOriginalUrl: false,
  // originalUrl will be set as the return url only if returnToOriginalUrl is true,
  // and the originalUrl passes this predicate
  isReturnUrlAllowed: url => /\.(css|jpe?g|gif|ico|js|json|png|svg|woff2?)$/i.test(url) === false,
})

// Session must be initialized first
app.use(session({
  secret: 'lol',
  resave: false,
  saveUninitialized: true
}))

// Use your configured gauth middleware
app.use(myGauth)

app.get(logoutEndPoint, function(req, res) {
  req.logout()
  res.send('<h1>You have logged out!</h1>')
})

app.get('/', function(req, res) {
  res.send(`
    <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Express GAuth</title>
        </head>
        <body>
          <h1>Hello Reaktorian ${req.user.displayName}!</h1>
          <p>Now you can has fun <a href="/logout">logging out</a>!</p>
        </body>
      </html>`)
})

app.listen(5555, function() {
  console.log('Waiting for Reaktorian Google login at http://localhost:5555')
})
