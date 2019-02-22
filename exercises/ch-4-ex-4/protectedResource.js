const express = require('express')
const bodyParser = require('body-parser')
const cons = require('consolidate')
const nosql = require('nosql')
const _ = require('underscore')
const cors = require('cors')

const authDb = nosql.load('database.nosql')
const resourceDb = nosql.load('resourceDb.nosql')
const app = express()

app.use(bodyParser.urlencoded({ extended: true })) // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore)
app.set('view engine', 'html')
app.set('views', 'files/protectedResource')
app.set('json spaces', 4)

app.use('/', express.static('files/protectedResource'))
app.use(cors())

function getAccessToken (req, res, next) {
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

  authDb.one().make(function (builder) {
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
          result.scope.join(' ')
        )
        req.access_token = result
      } else {
        console.log('No matching token was found')
      }
      next()
    })
  })
}

function requireAccessToken (req, res, next) {
  if (req.access_token) {
    next()
  } else {
    res.status(401).end()
  }
}

function hasRight (req, scope) {
  return _.contains(req.access_token.scope, scope)
}

app.get('/favorites', getAccessToken, requireAccessToken, function (req, res) {
  /*
   * Get different user information based on the information of who approved the token
   */
  const result = {
    user: 'Unknown',
    favorites: { movies: [], foods: [], music: [] }
  }
  // unknown user
  const userName = req.access_token.user
  if (userName) {
    resourceDb.one().make(function (builder) {
      builder.where('user', userName.toLowerCase())
      builder.callback(function (err, value) {
        console.log('Found user:', value)
        if (err) {
          console.error('%s: %s', err.name, err.message)
          res.status(500).end()
          return
        }

        result.user = value.user
        if (hasRight(req, 'movies')) {
          result.favorites.movies = value.favorites.movies.slice()
        }
        if (hasRight(req, 'foods')) {
          result.favorites.foods = value.favorites.foods.slice()
        }
        if (hasRight(req, 'music')) {
          result.favorites.music = value.favorites.music.slice()
        }
        console.log('Returning', result)
        res.json(result)
      })
    })
  } else {
    console.log('Returning', result)
    res.json(result)
  }
})

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address
  var port = server.address().port

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port)
})
