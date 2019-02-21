const express = require('express')
const bodyParser = require('body-parser')
const cons = require('consolidate')
const nosql = require('nosql').load('database.nosql')
const cors = require('cors')
const _ = require('underscore');

const app = express()

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

var getAccessToken = function (req, res, next) {
  var inToken = null
  var auth = req.headers['authorization']
  if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
    inToken = auth.slice('bearer '.length)
  } else if (req.body && req.body.access_token) {
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
        console.log('We found a matching token: %s for client: %s', result.access_token, result.client_id)
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

var savedWords = []

function insufficientScopeResponse (res, scope) {
  res.set('WWW-Authenticate', `Bearer realm=localhost:9002, error="insufficient_scope", scope="${scope}"`)
  res.status(403).end()
}

function hasRight(req, right) {
  return _.contains(req.access_token.scope, right)
}

// parse our middleware
app.all('*', getAccessToken, requireAccessToken)

app.get('/words', function (req, res) {
  /*
   * Make this function require the "read" scope
   */
  if (_.contains(req.access_token.scope, 'read')) {
    res.json({ words: savedWords.join(' '), timestamp: Date.now() })
  } else {
    insufficientScopeResponse(res, 'read');
  }
})

app.post('/words', function (req, res) {
  /*
   * Make this function require the "write" scope
   */
  if (hasRight(req, 'write')) {
    if (req.body.word) {
      savedWords.push(req.body.word)
    }
    res.status(201).json({ words: savedWords.join(' '), timestamp: Date.now() })
  } else {
    insufficientScopeResponse(res, 'write');
  }
})

app.delete('/words', function (req, res) {
  /*
   * Make this function require the "delete" scope
   */
  if (hasRight(req, 'delete')) {
    savedWords.pop()
    res.status(204).end()
  } else {
    insufficientScopeResponse(res, 'delete');
  }
})

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port)
})
