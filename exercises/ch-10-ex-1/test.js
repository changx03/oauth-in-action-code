const crypto = require('crypto')
const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generates cryptographically string pseudo-random string
 * @param {number} len length of random string
 * @param {Array} charSet character set for random string
 */
function randString (len, charSet) {
  const maxByte = 256 - (256 % charSet.length)
  let strLength = len;
  let randStr = ''
  while (strLength > 0) {
    const byteBuffer = crypto.randomBytes(Math.ceil(len * 256 / maxByte))
    for (let i = 0; i < byteBuffer.length && strLength > 0; i++) {
      const randInt = byteBuffer.readUInt8(i)
      if (randInt < maxByte) {
        randStr += charSet.charAt(randInt % charSet.length)
        strLength--
      }
    }
  }
  return randStr
}


console.log(randString(12, charSet))
