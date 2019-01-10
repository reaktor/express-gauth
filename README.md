## Google OAuth 2 with access control for Node Express app

[![Greenkeeper badge](https://badges.greenkeeper.io/pihvi/express-gauth.svg)](https://greenkeeper.io/)

### Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/package/@reaktor/express-gauth). Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```sh
$ npm install --save @reaktor/express-gauth
```

### Usage

#### Simple Express app with access allowed only from two domains with Google auth

``` javascript
const express = require('express')
const session = require('express-session')
const gauth = require('@reaktor/express-gauth')
const app = express()
const allowedLoginFromDomains = ['reaktor.fi', 'reaktor.com']
// Initialize Google auth middleware. You need your Google app id and secret.
const myGauth = gauth({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  clientDomain: 'http://localhost:5555',
  allowedDomains: allowedLoginFromDomains
})

// Session must be initialized first
app.use(session({
  secret: 'lol',
  resave: false,
  saveUninitialized: true
}))

// Use your configured gauth middleware
app.use(myGauth)

app.get('/', function(req, res) {
  res.send(`
    <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Simple Express GAuth</title>
        </head>
        <body>
          <h1>Hello Reaktorian ${req.user.displayName}!</h1>
        </body>
      </html>`)
})

app.listen(5555, function() {
  console.log('Waiting for Reaktorian Google login at http://localhost:5555')
})
```

#### Using Access token

[Full example](./examples/access_token.js)

``` javascript
  const app = express()
  app.use(session(/* options */))
  const myGauth = gauth({
    googleAuthorizationParams: {
      scope: ['profile', 'email']
    },
    // Other gauth options
  })
  app.use(myGauth)
  app.get('/', function(req, res) {
    const accessToken = req.session.passport.user.credentials.access_token
    // Access private files with Google API using the access token
  })
```

#### All config options

``` javascript
gauth({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  clientDomain: 'http://localhost:5555',
  allowedDomains: ['reaktor.fi', 'reaktor.com'], // User needs to login with Google and email with these domains.
  allowedEmails: ['john@example.com', 'jussi@example.com'], // These users are allowed login through Google auth.
  publicEndPoints: ['/logout'], // These end points do not require any authentication.
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
    hostedDomain: 'reaktor.fi',
    // To gain refreshable tokens
    accessType: 'offline',
    // This forces Google to send refresh tokens on each session start
    // By default Google sends refresh token only once per authentication to Google
    prompt: 'consent'
  },
  // Time in seconds to refresh access token before it expires
  refreshBefore: 10
  // Redirect user to the original url
  returnToOriginalUrl: false,
  // originalUrl will be set as the return url only if returnToOriginalUrl is true,
  // and the originalUrl passes this predicate
  isReturnUrlAllowed: url => /\.(css|jpe?g|gif|ico|js|json|png|svg|woff2?)$/i.test(url) === false,
})
```
[Full example](examples/all_configs_express.js)

### Version history

* 2.5.0 - Make it possible to disallow return urls when using returnToOriginalUrl
* 2.4.0 - Use refresh token to refresh expiring access tokens
* 2.3.0 - Add option for redirecting user to original url
* 2.2.0 - Add profile.credentials which contains user's authorization tokens
* 2.1.0 - Allow overriding Google OAuth 2.0 authorization params
* 2.0.1 - Show dependency monitoring badge in NPM page.
* 2.0.0 - Usage as middleware. Also remove failing automatic redirect logic.
* 1.1.4 - Add package-lock.json and update deps
* 1.1.3 - Fix domain parsing when emnail has multiple @ characters
* 1.1.2 - Remove lodash dependency
* 1.1.1 - Prompt for Google account to enable account change
* 1.1.0 - ACL by individual email
* 1.0.0 - ACL by domains
