const base64url = require('base64url')

const myStr = 'a quick brown fox jumps over the lazy dog'
// console.log(myStr)

// const b64MyStr = base64url(myStr)
// console.log(b64MyStr)

// console.log(base64url.fromBase64(b64MyStr))

// console.log(base64url.decode(b64MyStr))
// console.log(base64url.decode(base64url.fromBase64(b64MyStr)))

// const bufferMyStr = Buffer.from(myStr).toString('base64')
// console.log(bufferMyStr)
// console.log(Buffer.from(bufferMyStr, 'base64').toString())
// console.log(Buffer.from(bufferMyStr, 'base64').toString('utf8'))
// console.log(base64url.decode(bufferMyStr))

const crypto = require('crypto')
const c64Str = crypto.createHash('sha256').update(myStr).digest('base64')
console.log(c64Str)
const b64Str = Buffer.from(crypto.createHash('sha256').update(myStr).digest('base64')).toString('utf8')
console.log(b64Str)
console.log(c64Str === b64Str)

const obj = {
  typ: 'JWT',
  alg: 'none'
}

const jwt = Buffer.from(JSON.stringify(obj)).toString('base64')
console.log(jwt)

console.log(Buffer.from('eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9', 'base64').toString('utf8'))
// {"sub":"1234567890","name":"John Doe","admin":true} 
