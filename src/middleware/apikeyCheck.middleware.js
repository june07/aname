const { redis } = require('../config')
const { unwrapRedisObject } = require('../utils')

function apikeyCheckMiddleware(options) {
    const { app, errorOnMissing } = options || {}

    if (app !== 'aname') {
        return (_req, _res, next) => next() // Ensure middleware does not block if app is not 'aname'
    }

    return async (req, res, next) => {
        try {
            const apiKey = req.headers['x-api-key'] // Assuming API key is passed in the "x-api-key" header

            if (!apiKey) {
                return errorOnMissing ? res.status(401).json({ error: 'API key is missing' }) : next()
            }

            // Check if the API key exists in Redis
            const sub = await redis.HGET('aname:apikeys:keysub', apiKey)

            if (!sub) {
                return res.status(401).json({ error: 'Invalid API key' })
            }

            const apiKeyData = await unwrapRedisObject(redis.HGET('aname:apikeys', apiKey))

            if (!apiKeyData || new Date(apiKeyData.expiresAt) < new Date()) {
                return res.status(401).json({ error: 'Invalid or expired API key' })
            }

            // Attach the user sub to the request object for further use
            req.apiKeyData = { ...apiKeyData, sub }

            next()  // Proceed to the next middleware or route handler
        } catch (error) {
            logger.log({ level: 'error', namespace: logNS, message: 'API key validation error:', error })
            res.status(500).json({ error: 'Internal server error' })
        }
    }
}

module.exports = apikeyCheckMiddleware