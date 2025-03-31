class RedisUtils {
    constructor(options = {}) {
        const { redis, lockTimeout = 10000 } = options

        this.lockTimeout = lockTimeout
        this.redis = redis
    }
    lock = {
        acquire: async (key) => {
            const lockKey = `lock:${key}`
            const lockValue = Date.now() + this.lockTimeout + '' // Lock value with expiration time

            // Try to acquire the lock
            const result = await this.redis.set(lockKey, lockValue, 'NX', 'PX', this.lockTimeout)
            return result === 'OK'
        },
        release: async (key) => {
            const lockKey = `lock:${key}`
            const lockValue = Date.now() + this.lockTimeout + ''

            // Release the lock only if it is held by the current process
            const currentValue = await this.redis.get(lockKey)
            if (currentValue === lockValue) {
                await this.redis.del(lockKey)
            }
        }
    }
}

module.exports = options => new RedisUtils(options)