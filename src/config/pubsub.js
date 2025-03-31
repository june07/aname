const { createClient } = require('redis')
const logger = require('./logger')
const config = require('./config')

const { REDIS_URL } = process.env

const pubsub = ['publisher', 'subscriber'].map(name => {
    const client = createClient({
        url: config.NODE_ENV === 'production' ? `redis://default:${config.REDIS_HOST_PASSWORD}@redis` : REDIS_URL || 'redis://redis',
    })

    client.on('error', err => logger.error('Redis Client Error', err))
    client.connect().then(() => {
        logger.info(`Connected to Redis Pub/Sub ${name}`)
    })

    return { name, client }
}).reduce((acc, { name, client }) => {
    acc[name] = client
    return acc
}, {})

module.exports = pubsub
