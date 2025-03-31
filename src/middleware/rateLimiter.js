const { rateLimiters } = require('../common/utils')

const middleware = limiter => (req, res, next) => {
    rateLimiters[limiter].consume(req.ip)
        .then(() => {
            next()
        })
        .catch(() => {
            res.status(429).send('Too Many Requests')
        })
}

module.exports = {
    authLimiter: middleware('authLimiter'),
    applyDiscountCodeLimiter: middleware('applyDiscountCodeLimiter'),
}
