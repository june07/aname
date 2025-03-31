const crypto = require('crypto')

function getUserOffset(userId, maxOffset = 1048576) {
    const hash = crypto.createHash('sha256').update(userId).digest('hex')
    const num = parseInt(hash.slice(0, 8), 16) // Take first 8 hex digits
    return num % maxOffset
}

module.exports = getUserOffset