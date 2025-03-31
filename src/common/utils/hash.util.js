const { createHash } = require('crypto')

const hash = (string, algo = 'md5', encoding = 'hex') => {
    const hash = createHash(algo)
    
    hash.update(string)
    
    return hash.digest(encoding)
}

module.exports = hash