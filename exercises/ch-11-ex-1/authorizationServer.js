var express = require('express')
var url = require('url')
var bodyParser = require('body-parser')
var randomstring = require('randomstring')
var cons = require('consolidate')
var nosql = require('nosql').load('database.nosql')
var querystring = require('querystring')
var __ = require('underscore')
__.string = require('underscore.string')
var base64url = require('base64url')

var app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true })) // support form-encoded bodies (for the token endpoint)

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/authorizationServer')
app.set('json spaces', 4)

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
    redirect_uris: ['http://localhost:9000/callback'],
    scope: 'foo bar'
  }
]

var userInfo = {
  alice: {
    sub: '9XE3-JI34-00132A',
    preferred_username: 'alice',
    name: 'Alice',
    email: 'alice.wonderland@example.com',
    email_verified: true
  },

  bob: {
    sub: '1ZT5-OE63-57383B',
    preferred_username: 'bob',
    name: 'Bob',
    email: 'bob.loblob@example.net',
    email_verified: false
  },

  carol: {
    sub: 'F5Q1-L6LGG-959FS',
    preferred_username: 'carol',
    name: 'Carol',
    email: 'carol.lewis@example.net',
    email_verified: true,
    username: 'clewis'
  }
}

var codes = {}

var requests = {}

var getClient = function (clientId) {
  return __.find(clients, function (client) {
    return client.client_id == clientId
  })
}

var getUser = function (username) {
  return userInfo[username]
}

app.get('/', function (req, res) {
  res.render('index', { clients: clients, authServer: authServer })
})

app.get('/authorize', function (req, res) {
  var client = getClient(req.query.client_id)

  if (!client) {
    console.log('Unknown client %s', req.query.client_id)
    res.render('error', { error: 'Unknown client' })
  } else if (!__.contains(client.redirect_uris, req.query.redirect_uri)) {
    console.log(
      'Mismatched redirect URI, expected %s got %s',
      client.redirect_uris,
      req.query.redirect_uri
    )
    res.render('error', { error: 'Invalid redirect URI' })
  } else {
    var rscope = req.query.scope ? req.query.scope.split(' ') : undefined
    var cscope = client.scope ? client.scope.split(' ') : undefined
    if (__.difference(rscope, cscope).length > 0) {
      var urlParsed = buildUrl(req.query.redirect_uri, {
        error: 'invalid_scope'
      })
      res.redirect(urlParsed)
      return
    }

    var reqid = randomstring.generate(8)

    requests[reqid] = req.query

    res.render('approve', { client: client, reqid: reqid, scope: rscope })
  }
})

app.post('/approve', function (req, res) {
  var reqid = req.body.reqid
  var query = requests[reqid]
  delete requests[reqid]

  if (!query) {
    // there was no matching saved request, this is an error
    res.render('error', { error: 'No matching authorization request' })
    return
  }

  if (req.body.approve) {
    if (query.response_type == 'code') {
      // user approved access

      var rscope = getScopesFromForm(req.body)
      var client = getClient(query.client_id)
      var cscope = client.scope ? client.scope.split(' ') : undefined
      if (__.difference(rscope, cscope).length > 0) {
        var urlParsed = buildUrl(query.redirect_uri, {
          error: 'invalid_scope'
        })
        res.redirect(urlParsed)
        return
      }

      var code = randomstring.generate(8)

      var user = getUser(req.body.user)

      // save the code and request for later

      codes[code] = { request: query, scope: rscope, user: user }

      var urlParsed = buildUrl(query.redirect_uri, {
        code: code,
        state: query.state
      })
      res.redirect(urlParsed)
    } else {
      // we got a response type we don't understand
      var urlParsed = buildUrl(query.redirect_uri, {
        error: 'unsupported_response_type'
      })
      res.redirect(urlParsed)
    }
  } else {
    // user denied access
    var urlParsed = buildUrl(query.redirect_uri, {
      error: 'access_denied'
    })
    res.redirect(urlParsed)
  }
})

app.post('/token', function (req, res) {
  var auth = req.headers['authorization']
  if (auth) {
    // check the auth header
    var clientCredentials = decodeClientCredentials(auth)
    var clientId = clientCredentials.id
    var clientSecret = clientCredentials.secret
  }

  // otherwise, check the post body
  if (req.body.client_id) {
    if (clientId) {
      // if we've already seen the client's credentials in the authorization header, this is an error
      console.log('Client attempted to authenticate with multiple methods')
      res.status(401).json({ error: 'invalid_client' })
      return
    }

    var clientId = req.body.client_id
    var clientSecret = req.body.client_secret
  }

  var client = getClient(clientId)
  if (!client) {
    console.log('Unknown client %s', clientId)
    res.status(401).json({ error: 'invalid_client' })
    return
  }

  if (client.client_secret != clientSecret) {
    console.log(
      'Mismatched client secret, expected %s got %s',
      client.client_secret,
      clientSecret
    )
    res.status(401).json({ error: 'invalid_client' })
    return
  }

  if (req.body.grant_type == 'authorization_code') {
    var code = codes[req.body.code]

    if (code) {
      delete codes[req.body.code] // burn our code, it's been used
      if (code.request.client_id == clientId) {
        /*
         * Generate a JWT-formatted token instead of this random token
         */
        // var access_token = randomstring.generate()
        const jwtHeader = {
          typ: 'JWT',
          alg: 'none'
        }
        const jwtPayload = {
          iss: 'http://localhost:9001/',
          sub: code.user ? code.user.sub : undefined,
          aud: 'http://localhost:9002/',
          iat: Math.floor(Date.now() / 1000), // in milliseconds elapsed since 1/1/1970 00:00:00 UTC
          exp: Math.floor(Date.now() / 1000) + 5 * 60,
          jti: randomstring.generate(8)
        }
        const access_token =
          Buffer.from(JSON.stringify(jwtHeader)).toString('base64').replace(/=+$/g, '') + '.' +
          Buffer.from(JSON.stringify(jwtPayload)).toString('base64').replace(/=+$/g, '') + '.'

        nosql.insert({
          access_token: access_token,
          client_id: clientId,
          scope: code.scope,
          user: code.user
        })

        console.log('Issuing access token %s', access_token)

        var token_response = {
          access_token: access_token,
          token_type: 'Bearer',
          scope: code.scope.join(' ')
        }

        res.status(200).json(token_response)
        console.log('Issued tokens for code %s', req.body.code)
      } else {
        console.log(
          'Client mismatch, expected %s got %s',
          code.request.client_id,
          clientId
        )
        res.status(400).json({ error: 'invalid_grant' })
      }
    } else {
      console.log('Unknown code, %s', req.body.code)
      res.status(400).json({ error: 'invalid_grant' })
    }
  } else if (req.body.grant_type == 'refresh_token') {
    nosql.one().make(function (builder) {
      builder.where('refresh_token', req.body['refresh_token'])
      builder.callback(function (err, value) {
        if (err) {
          console.error('%s: %s', err.name, err.message)
          res.status(500).end()
          return
        }

        // not found
        if (!value) {
          res.status(400).json({ error: 'invalid_grant' })
        } else {
          // unknown client
          if (value['client_id'] !== clientId) {
            console.log(
              'Invalid client using a refresh token, expected %s got %s',
              value['client_id'],
              clientId
            )
            // remove the compromised refresh_token
            nosql.remove().make(function (builder) {
              builder.where('refresh_token', req.body['refresh_token'])
              builder.callback(function (err, count) {
                if (err) {
                  console.error('%s: %s', err.name, err.message)
                  res.status(500).end()
                  return
                }
                console.log(
                  'remove %d with client_id: %s',
                  count,
                  value['client_id']
                )
                res.status(400).json({ error: 'invalid_grant' })
              })
            })
          }

          // issue new access_token
          console.log(
            'We found a matching token: %s',
            req.body['refresh_token']
          )
          var access_token = randomstring.generate()
          var token_response = {
            access_token: access_token,
            token_type: 'Bearer',
            refresh_token: req.body.refresh_token
          }
          nosql.insert({ access_token: access_token, client_id: clientId })
          console.log(
            'Issuing access token %s for refresh token %s',
            access_token,
            req.body.refresh_token
          )
          res.status(200).json(token_response)
        }
      })
    })
  } else {
    console.log('Unknown grant type %s', req.body.grant_type)
    res.status(400).json({ error: 'unsupported_grant_type' })
  }
})

var buildUrl = function (base, options, hash) {
  var newUrl = url.parse(base, true)
  delete newUrl.search
  if (!newUrl.query) {
    newUrl.query = {}
  }
  __.each(options, function (value, key, list) {
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

var getScopesFromForm = function (body) {
  return __.filter(__.keys(body), function (s) {
    return __.string.startsWith(s, 'scope_')
  }).map(function (s) {
    return s.slice('scope_'.length)
  })
}

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
