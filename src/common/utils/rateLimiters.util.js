const { RateLimiterRedis } = require('rate-limiter-flexible')

const { config, redis } = require('../../config')

function pointsPerTier(tier) {
    switch (tier) {
        case 'free':
            return 100
        case 'developer':
            return 1000
        case 'business':
            return 10000
        default:
            return 100
    }
}
const limiters = {
    authLimiter: new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl-auth-',
        points: 10, // 10 requests
        duration: 1, // per 1 second by IP

        // Use this flag for the `redis` package
        useRedisPackage: true,
    }),
    applyDiscountCodeLimiter: new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl-discount-',
        points: 3,
        duration: 3600,
        useRedisPackage: true,
    }),
    repliconUpload: new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl-replicon-upload-',
        points: config.NODE_ENV === 'production' ? 11 : 999,
        duration: 3600,
        useRedisPackage: true,
    }),
    repliconReplicate: new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl-replicon-replicate-',
        points: config.NODE_ENV === 'production' ? 11 : 999,
        duration: 3600,
        useRedisPackage: true,
    }),
    submitMessengerStatsLimiter: new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl-messenger-stats-',
        points: config.NODE_ENV === 'production' ? 11 : 999,
        duration: 3600,
        useRedisPackage: true,
    }),
    aname: (req) => {
        const tier = req.user?.tier || 'free'

        return new RateLimiterRedis({
            storeClient: redis,
            keyPrefix: 'rl-aname-',
            points: config.NODE_ENV === 'production' ? pointsPerTier(tier) : 999,
            duration: 3600 * 24, // 1 day
            useRedisPackage: true,
        })
    }
}

module.exports = limiters