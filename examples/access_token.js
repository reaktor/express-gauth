const express = require('express')
const session = require('express-session')
const gauth = require('../index.js')
const app = express()
const allowedLoginFromDomains = ['reaktor.fi', 'reaktor.com']
// Initialize Google auth middleware. You need your Google app id and secret.
const myGauth = gauth({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  clientDomain: 'http://localhost:5555',
  allowedDomains: allowedLoginFromDomains,
  googleAuthorizationParams: {
    scope: ['profile', 'email', '<GOOGLE API SCOPE>'],
    // To gain refreshable tokens
    accessType: 'offline',
    // This forces Google to send refresh tokens on each session start
    // By default Google sends refresh token only once per authentication to Google
    prompt: 'consent',
  }
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
  const accessToken = req.session.passport.user.credentials.access_token
  // Access Google APIs using the access token
})

app.listen(5555, function() {
  console.log('Waiting for Reaktorian Google login at http://localhost:5555')
})
