/**
 * Extract the real IP address from a socket handshake.
 * Prioritizes x-forwarded-for header, falling back to the direct address.
 * 
 * @param {Object} handshake - The socket handshake object.
 * @returns {string} - The real IP address.
 */
function realIpFromHandshake(handshake) {
    // Prefer x-forwarded-for if available, otherwise use handshake.address
    return handshake.headers?.['x-forwarded-for']?.split(',')[0].trim() || handshake.address || 'unknown';
}

module.exports = realIpFromHandshake