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
