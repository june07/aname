const { config, logger } = require('../../config')
const logNS = 'aname-backend:letters:common:utils'
const roles = {
    anameFree: {
        names: 100,
    },
    anameDev: {
        names: 1000,
    },
    anamePro: {
        names: 10_000,
    }
}

function getRoleLimits({ role, limit }) {
    const roleConfig = roles[role]

    if (roleConfig && roleConfig[limit] !== undefined) {
        logger.log({ level: 'info', namespace: logNS, message: 'Role limit found', role, limit })
        return roleConfig[limit]
    }

    logger.log({ level: 'info', namespace: logNS, message: 'Role limit not found, returning default 0' })
    // Default limit if role or limit is not found
    return 0
}

module.exports = {
    getRoleLimits
}