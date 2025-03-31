const { redis, esm: esmPromise } = require('../../config/index.js')
const { LRUCache } = require('lru-cache')
const { createCache } = require('cache-manager')
let esm = esmPromise.then(modules => esm = modules).catch(e => { throw e })
let _cache

// Multiple stores
async function cache(options) {
    if (_cache) {
        return _cache
    }
    _cache = (async () => {
        const { Keyv, KeyvValkey } = await esm

        return await createCache({
            stores: [
                //  High performance in-memory cache with LRU and TTL
                new Keyv.default({
                    store: new LRUCache({ max: 500 }),
                }),
                //  Redis Store
                new Keyv.default({
                    store: new KeyvValkey.default(redis.options.url, options?.valkeyOptions || {}),
                    useRedisSets: false
                })
            ]
        })
    })()

    return _cache
}

module.exports = cache