const express = require('express')
const url = require('url')
const bodyParser = require('body-parser')
const randomString = require('randomstring')
const cons = require('consolidate')
const nosql = require('nosql').load('database.nosql')
const querystring = require('querystring')
const session = require('express-session')
const crypto = require('crypto')
const _ = require('underscore')
_.string = require('underscore.string')

function uuidFromBytes (rnd) {
  rnd[6] = (rnd[6] & 0x0f) | 0x40
  rnd[8] = (rnd[8] & 0x3f) | 0x80
  rnd = rnd.toString('hex').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/)
  rnd.shift()
  return rnd.join('-')
}

function genuuid () {
  return uuidFromBytes(crypto.randomBytes(16))
}

const app = express()
const sess = {
  genid: function () {
    return genuuid()
  },
  secret: 'awesome_cat',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 2 * 24 * 3600 * 1000 /* 2 day */ }
}

/**
 * Secure cookie only works over TLS.
 * If your site is HTTP, the cookie will not be set
 * https://github.com/expressjs/session
 */
console.log('NODE_ENV: %s', app.get('env'))
if (app.get('env') === 'production') {
  app.set('trust proxy', 1)
  sess.cookie.secure = true
}

app.use(session(sess))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true })) // support form-encoded bodies (for the token endpoint)

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/authorizationServer')
app.set('json spaces', 4)

/**
 * constants
 */

// authorization server information
var authServer = {
  authorizationEndpoint: 'http://localhost:9001/authorize',
  tokenEndpoint: 'http://localhost:9001/token'
}

// client information
var clients = [
  {
    client_id: 'oauth-client-1',
    client_secret: 'oauth-client-secret-1',
    redirect_uris: ['http://localhost:9000/callback']
  }
]

var codes = {}

// use session instead
// var requests = {}

/**
 * utility functions
 */

var getClient = function (clientId) {
  return _.find(clients, function (client) {
    return client.client_id == clientId
  })
}

var buildUrl = function (base, options, hash) {
  var newUrl = url.parse(base, true)
  delete newUrl.search
  if (!newUrl.query) {
    newUrl.query = {}
  }
  _.each(options, function (value, key, list) {
    newUrl.query[key] = value
  })
  if (hash) {
    newUrl.hash = hash
  }

  return url.format(newUrl)
}

var decodeClientCredentials = function (auth) {
  var clientCredentials = Buffer.from(auth.slice('basic '.length), 'base64')
    .toString()
    .split(':')
  var clientId = querystring.unescape(clientCredentials[0])
  var clientSecret = querystring.unescape(clientCredentials[1])
  return { id: clientId, secret: clientSecret }
}

function redirectWithErr (res, msg) {
  const urlParsed = buildUrl(query['redirect_uri'], {
    error: msg
  })
  res.redirect(urlParsed)
}

/**
 * routes
 */

app.get('/', function (req, res) {
  res.render('index', { clients: clients, authServer: authServer })
})

app.get('/authorize', function (req, res) {
  /*
   * Process the request, validate the client, and send the user to the approval page
   */
  const client = getClient(req.query['client_id'])
  if (!client) {
    res.render('error', { error: 'Unknown client' })
    return
  } else if (!_.contains(client['redirect_uris'], req.query['redirect_uri'])) {
    res.render('error', { error: 'Invalid redirect URI' })
    return
  }
  const reqid = randomString.generate(8)
  // requests[reqid] = req.query
  req.session.client = {
    reqid,
    query: req.query
  }
  res.render('approve', { client: client, reqid })
})

app.post('/approve', function (req, res) {
  /*
   * Process the results of the approval page, authorize the client
   */
  console.log('session:', req.session)
  const reqid = req.body.reqid
  if (!req.session.client || !req.session.client.query) {
    res.render('error', { error: 'No matching authorization request' })
    return
  }
  const query = req.session.client.query
  req.session.destroy()
  if (req.body.approve) { // user approved access
    if (query['response_type'] === 'code') {  // now, issue a new authorization code
      const code = randomString.generate(8) // authorization code is not access_token
      codes[code] = { request: query }
      const urlParsed = buildUrl(query['redirect_uri'], {
        code: code,
        state: query.state
      })
      res.redirect(urlParsed)
    } else {
      redirectWithErr(res, 'unsupported_response_type')
    }
  } else { // user denied access
    redirectWithErr(res, 'access_denied')
  }
})

app.post('/token', function (req, res) {
  /*
   * Process the request, issue an access token
   */
})

app.use('/', express.static('files/authorizationServer'))

// clear the database
nosql.clear()

var server = app.listen(9001, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port

  console.log(
    'OAuth Authorization Server is listening at http://%s:%s',
    host,
    port
  )
})
