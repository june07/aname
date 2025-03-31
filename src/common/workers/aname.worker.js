const { logger, config, redis, esm: esmPromise } = require('../../config')
const { unwrapRedisObject } = require('../../utils')
const {
    NODE_ENV,
    REDIS_HOST_PASSWORD,
} = config
const logNS = 'aname-backend:worker'
let esm = esmPromise.then(modules => esm = modules).catch(e => { throw e })

class AnameWorker {
    constructor() {
        this.interval = undefined
        this.init()
    }

    async init() {
        const { Queue } = esm
        this.bullmq = await esm.Queue

        if (NODE_ENV !== 'production') {
            await this.deleteDevKeys()
        }

        this.queue = new Queue('{messageQueue}', {
            connection: {
                host: redis.options.host || 'redis',
                port: redis.options.port || 6379,
                password: NODE_ENV === 'production' ? REDIS_HOST_PASSWORD : undefined,
            },
        })

        this.interval = setInterval(async () => {
            await Promise.all([
                this.deleteTemporaryNames()
            ])
        }, NODE_ENV === 'production' ? 60_000_000 : 60_000)
    }

    async deleteTemporaryNames() {
        logger.log({ level: 'info', namespace: logNS, message: `Running background temporary names cleanup interval` })

    }

    async deleteDevKeys() {
        // Fetch all keys matching the pattern `bull:*`
        const keys = [
            ...await redis.keys('aname:*'),
            ...await redis.keys('bull:*'),
        ]

        if (keys.length === 0) {
            return
        }

        // Delete the keys in bulk
        await redis.del(keys)

        console.log(`Deleted ${keys.length} keys`)
    }
}

const anameWorker = new AnameWorker()

module.exports = AnameWorker
