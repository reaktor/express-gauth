## Google OAuth 2 with access control for Node Express app

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

// Session must be initialized first
app.use(session({
  secret: 'lol',
  resave: false,
  saveUninitialized: true
}))

// Then initialize Google auth. You need your Google app id and secret.
gauth({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  clientDomain: 'http://localhost:5555',
  allowedDomains: allowedLoginFromDomains,
  clientExpressApp: app
})

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
  }
})
``` 
[Full example](examples/all_configs_express.js)

### Version history

* 1.1.0 - ACL by individual email
* 1.0.0 - ACL by domains
