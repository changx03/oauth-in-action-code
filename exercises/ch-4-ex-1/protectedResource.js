var express = require('express')
var bodyParser = require('body-parser')
var cons = require('consolidate')
var nosql = require('nosql').load('database.nosql')
var __ = require('underscore')
var cors = require('cors')

var app = express()

app.use(bodyParser.urlencoded({ extended: true })) // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/protectedResource')
app.set('json spaces', 4)

app.use('/', express.static('files/protectedResource'))
app.use(cors())

var resource = {
  name: 'Protected Resource',
  description: 'This data has been protected by OAuth 2.0'
}

function getAccessToken (req, res, next) {
  /*
   * Scan for an access token on the incoming request.
   */
  // get bearer access_token from request
  let inToken = null
  const auth = req.headers['authorization']
  if (auth && auth.toLowerCase().indexOf('bearer') === 0) {
    // get access_token from header
    inToken = auth.slice('bearer '.length)
  } else if (req.body && req.body.access_token) {
    // get access_token from body
    inToken = req.body.access_token
  } else if (req.query && req.query.access_token) {
    // get access_token from query
    inToken = req.query.access_token
  }
  console.log('Incoming token: %s', inToken)

  // validate access_token
  nosql.one().make(function (builder) {
    builder.where('access_token', inToken)
    builder.callback(function (err, result) {
      if (err) {
        console.error('%s: %s', err.name, err.message)
        res.status(500).end()
        return
      }
      if (result) {
        console.log(
          'We found a matching token: %s for client: %s',
          result.access_token,
          result.client_id
        )
        req.access_token = result.access_token
      } else {
        console.log('No matching token was found.')
      }
      next()
    })
  })
}

function requireAccessToken (req, res, next) {
  /*
   * Check to see if the access token was found or not
   */
  if (req.access_token) {
    next()
  } else {
    res.status(401).end()
  }
}

app.all('*', getAccessToken)

app.options('/resource', cors())

app.post('/resource', cors() /*, getAccessToken */, requireAccessToken, function (req, res) {
  /*
   * getAccessToken middleware is already used for all routes
   */
  res.json(resource)
})

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port)
})
