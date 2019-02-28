var express = require('express')
var url = require('url')
var bodyParser = require('body-parser')
var randomstring = require('randomstring')
var cons = require('consolidate')
var nosql = require('nosql').load('database.nosql')
var qs = require('qs')
var querystring = require('querystring')
var request = require('sync-request')
var __ = require('underscore')
var base64url = require('base64url')
var jose = require('jsrsasign')

var app = express()

app.use(bodyParser.urlencoded({ extended: true })) // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/protectedResource')
app.set('json spaces', 4)

app.use('/', express.static('files/protectedResource'))

var resource = {
  name: 'Protected Resource',
  description: 'This data has been protected by OAuth 2.0'
}

var sharedTokenSecret = 'shared token secret!'

var rsaKey = {
  alg: 'RS256',
  e: 'AQAB',
  n:
    'p8eP5gL1H_H9UNzCuQS-vNRVz3NWxZTHYk1tG9VpkfFjWNKG3MFTNZJ1l5g_COMm2_2i_YhQNH8MJ_nQ4exKMXrWJB4tyVZohovUxfw-eLgu1XQ8oYcVYW8ym6Um-BkqwwWL6CXZ70X81YyIMrnsGTyTV6M8gBPun8g2L8KbDbXR1lDfOOWiZ2ss1CRLrmNM-GRp3Gj-ECG7_3Nx9n_s5to2ZtwJ1GS1maGjrSZ9GRAYLrHhndrL_8ie_9DS2T-ML7QNQtNkg2RvLv4f0dpjRYI23djxVtAylYK4oiT_uEMgSkc4dxwKwGuBxSO0g9JOobgfy0--FUHHYtRi0dOFZw',
  kty: 'RSA',
  kid: 'authserver'
}

var protectedResources = {
  resource_id: 'protected-resource-1',
  resource_secret: 'protected-resource-secret-1'
}

var authServer = {
  introspectionEndpoint: 'http://localhost:9001/introspect'
}

var getAccessToken = function (req, res, next) {
  // check the auth header first
  var auth = req.headers['authorization']
  var inToken = null
  if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
    inToken = auth.slice('bearer '.length)
  } else if (req.body && req.body.access_token) {
    // not in the header, check in the form body
    inToken = req.body.access_token
  } else if (req.query && req.query.access_token) {
    inToken = req.query.access_token
  }

  console.log('Incoming token: %s', inToken)

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
          'We found a matching token: %s for client: %s with scope:',
          result.access_token,
          result.client_id,
          Object.prototype.toString.call(result.scope) === '[object Array]'
            ? result.scope.join(' ')
            : ''
        )
        req.access_token = result
      } else {
        console.log('No matching token was found')
      }
      next()
    })
  })
}

var requireAccessToken = function (req, res, next) {
  if (req.access_token) {
    next()
  } else {
    res.status(401).end()
  }
}

app.get('/helloWorld', getAccessToken, requireAccessToken, function (req, res) {
  if (req.access_token) {
    let resource = {
      greeting: ''
    }

    if (req.query.language == 'en') {
      // res.send('Hello World')
      resource.greeting = 'Hello World'
    } else if (req.query.language == 'de') {
      // res.send('Hallo Welt')
      resource.greeting = 'Hallo Welt'
    } else if (req.query.language == 'it') {
      // res.send('Ciao Mondo')
      resource.greeting = 'Ciao Mondo'
    } else if (req.query.language == 'fr') {
      // res.send('Bonjour monde')
      resource.greeting = 'Bonjour monde'
    } else if (req.query.language == 'es') {
      // res.send('Hola mundo')
      resource.greeting = 'Hola mundo'
    } else {
      // res.send('Error, invalid language: ' + req.query.language)
      // res.send('Error, invalid language: ' + querystring.escape(req.query.language))
      resource.greeting = 'Error, invalid language: ' + req.query.language
    }
    console.log(resource)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.json(resource)
  }
})

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port
  console.log('ch-8-ex-1')
  console.log('OAuth Resource Server is listening at http://%s:%s', host, port)
})
