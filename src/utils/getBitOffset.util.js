const crypto = require('crypto')

function getBitOffset(id, maxOffsetHex = 8) {
    if (typeof id !== 'string') {
        throw new TypeError('ID must be a string')
    }
    if (typeof maxOffsetHex !== 'number' || maxOffsetHex < 1 || maxOffsetHex > 64) {
        throw new RangeError('maxOffsetHex must be between 1 and 64')
    }

    // Use BigInt for handling larger shifts
    const maxOffset = 1n << BigInt(maxOffsetHex * 4) // Convert hex digits to bits (4 bits per hex digit)

    // Create a hash of the id using SHA-256
    const hash = crypto.createHash('sha256').update(id).digest('hex')

    // Convert the relevant part of the hash to a BigInt
    const num = BigInt('0x' + hash.slice(0, maxOffsetHex)) // Extract only the required hex digits

    // Ensure the offset stays within range using BigInt operations
    return Number(num % maxOffset) // Convert result to a Number before returning
}

module.exports = getBitOffset