const { logger, redis } = require('../config')
const { anameService } = require('../common/services')
const cacheService = require('../common/services/cache.service')
const roleUtils = require('../common/utils/role.util')
const logNS = 'checkNameGenerationAccess.middleware'
let cache = cacheService().then(modules => cache = modules).catch(e => { throw e })

async function checkNameGenerationAccess(req, res, next) {
    const { publicKey } = req.query
    let didGenerateAName

    if (req.auth || req.apiKeyData) {
        const sub = req.auth?.sub || req.apiKeyData.sub
        // do further checks based on the user sub vs total usernames generated against their current role
        const count = await redis.HGET('aname:names:count', sub) || 0
        const role = req.auth?.sub
            ? req.auth.resource_access['ai'].roles.find(role => role.startsWith('aname'))
            : req.apiKeyData.role
        const roleLimits = roleUtils.getRoleLimits({ role, limit: 'names' })

        if (count >= roleLimits) {
            return res.status(403).json({ error: 'Free name generation limit reached. Please upgrade.' })
        }

        return next()
    }

    didGenerateAName = await cache.get(`aname:didGenerateAName:${publicKey}`)

    if (didGenerateAName) {
        return res.status(403).json({ error: 'Free name generation limit reached. Please authenticate.' })
    }

    try {        
        didGenerateAName = await anameService.getDidGenerateAName(publicKey)
    } catch (error) {
        logger.error({ level: 'error', namespace: logNS, message: `Redis error: ${error.message}` })
        return res.status(500).json({ error: 'Internal server error' })
    }

    logger.log({ level: 'info', namespace: logNS, message: `publicKey: ${publicKey}, didGenerateAName: ${didGenerateAName}` })

    if (didGenerateAName) {
        await cache.set(`aname:didGenerateAName:${publicKey}`, true, 86400)
        return res.status(403).json({ error: 'Free name generation limit reached. Please authenticate.' })
    }

    next()
}

module.exports = checkNameGenerationAccess
