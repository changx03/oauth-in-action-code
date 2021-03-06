const express = require('express')
const bodyParser = require('body-parser')
const cons = require('consolidate')
const nosql = require('nosql')
const cors = require('cors')

const db = nosql.load('database.nosql')
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

  db.one().make(function (builder) {
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

app.options('/resource', cors())

app.post('/resource', cors(), getAccessToken, requireAccessToken, function (
  req,
  res
) {
  res.json(resource)
})

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port)
})
