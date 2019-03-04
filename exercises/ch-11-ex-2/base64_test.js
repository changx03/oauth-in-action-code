const base64url = require('base64url')

const payload = {
  iss: 'http://localhost:9001/',
  iat: Math.floor(Date.now() / 1000),
  formula: '1+1=2'
}

// base64URL replace
// '+' -> %2B
// '/' -> %2F
// '=' -> %3D
// omit padding '='
console.log(JSON.stringify(payload))
const b64str = Buffer.from(JSON.stringify(payload)).toString('base64')
console.log(b64str)
console.log(base64url.fromBase64(b64str))
console.log(base64url(JSON.stringify(payload)))
