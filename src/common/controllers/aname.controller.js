const { logger, esm: esmPromise } = require('../../config/index.js')
const anameService = require('../services/aname.service.js')
const anameUtils = require('../../utils/aname.utils.js')
const logNS = 'aname-backend:aname:controller'
let esm = esmPromise.then(modules => esm = modules).catch(e => { throw e })

async function anamePublic(req, res, next) {
    const { auth } = req
    const { publicKey } = req.params

    try {
        const aname = await anameService.aname(auth, publicKey)

        if (!aname) {
            return res.status(404).json({ error: 'Aname not found' })
        }
        res.send({ aname })
    } catch (error) {
        logger.log({ level: 'error', namespace: logNS, message: error })
        next({ error })
    }
}
async function aname(req, res) {
    const sub = req.auth?.sub || req.apiKeyData?.sub
    const options = req.query || {}

    const decoded = decodeURI(req.originalUrl)
    const queryParams = new URLSearchParams(decoded.split('?')[1])
    const dictionaries = queryParams.get('dictionaries')

    if (dictionaries) {
        try {
            req.query.dictionaries = JSON.parse(dictionaries)
        } catch (error) {
            return res.status(400).json({ error: 'Invalid dictionaries parameter' }) // Return error if parsing fails
        }
    }

    try {
        const data = await anameUtils.generateAname(sub ? { ...options, sub } : options)

        res.status(200).send(data)
    } catch (error) {
        if (error)
            res.status(500).send(error.message)
    }
}
async function lookupAname(req, res) {
    const { name } = req.params
    const { publicKey } = req.query

    try {
        const data = await anameUtils.lookupAname(name, publicKey)

        if (data instanceof Error) {
            const error = data

            res.status(error.statusCode).send(error.message)
            return
        }

        res.status(200).send(data)
    } catch (error) {
        res.status(500).send(error.message)
    }
}
async function anameStats(req, res) {
    const { auth } = req

    const stats = await anameService.stats(auth)

    res.status(200).send({ stats })
}
async function anameApiKey(req, res) {
    const { auth } = req

    const apikey = await anameService.getApiKey(auth)

    res.status(200).send({ apikey })
}

module.exports = {
    aname,
    lookupAname,
    anameStats,
    anameApiKey,
    public: {
        aname: anamePublic
    }
}
