const { basename } = require('path')
const crypto = require('crypto')
const { LRUCache } = require('lru-cache')
const { v5: uuidv5 } = require('uuid')

const { redis, logger, config, esm: esmPromise } = require('../config')
const anameService = require('../common/services/aname.service')
const unwrapRedisObject = require('./unwrapRedisObject.util')
const ApiError = require('./ApiError')
const cache = new LRUCache({ max: 500 })
const logNS = 'aname-backend:aname:utils'
const {
    HOSTNAME,
    NODE_ENV,
    ANAME_PRIVATE_KEY
} = config
let esm = esmPromise.then(modules => esm = modules).catch(e => { throw e })

function encryptMessage(message, recipientPublicKeyHex) {
    const senderPrivateKey = Buffer.from(ANAME_PRIVATE_KEY, 'hex')
    const recipientPublicKey = Buffer.from(recipientPublicKeyHex, 'hex')

    // Derive shared secret using X25519
    const sharedSecret = esm.x25519.getSharedSecret(senderPrivateKey, recipientPublicKey)

    // Derive AES-GCM key (first 32 bytes of shared secret)
    const key = crypto.createHash('sha256').update(sharedSecret).digest()

    // Generate a random IV (Initialization Vector)
    const iv = crypto.randomBytes(12)

    // Encrypt the message using AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()])

    // Get the authentication tag
    const authTag = cipher.getAuthTag()

    // Return everything as a hex string
    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex'),
        authTag: authTag.toString('hex'),
    }
}
function decryptMessage(encryptedObj, senderPublicKeyHex) {
    const recipientPrivateKey = Buffer.from(ANAME_PRIVATE_KEY, 'hex')
    const senderPublicKey = Buffer.from(senderPublicKeyHex, 'hex')

    // Derive shared secret
    const sharedSecret = esm.x25519.getSharedSecret(recipientPrivateKey, senderPublicKey)

    // Derive AES-GCM key
    const key = crypto.createHash('sha256').update(sharedSecret).digest()

    // Extract IV, encrypted data, and authentication tag
    const iv = Buffer.from(encryptedObj.iv, 'hex')
    const encryptedData = Buffer.from(encryptedObj.encryptedData, 'hex')
    const authTag = Buffer.from(encryptedObj.authTag, 'hex')

    // Decrypt using AES-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])

    return decrypted.toString('utf8') // Return the original message
}
async function lookupAname(uniqueName, publicKey) {
    try {
        const encryptedSeed = await unwrapRedisObject(redis.HGET('aname:names:encryptedSeed', `${uniqueName} ${publicKey}`))

        if (!encryptedSeed) return new ApiError(404, `No seed found for ${uniqueName} with publicKey ${publicKey}`)

        const seed = decryptMessage(encryptedSeed, publicKey)

        if (!seed) return new ApiError(404, `No seed found for ${uniqueName} with publicKey ${publicKey}`)

        return seed
    } catch (error) {
        logger.log({ level: 'info', namespace: logNS, message: `Failed to lookupAname: ${uniqueName} with seed: ${seed}` })
        throw error
    }
}
/**
 * Generate a stable SHA-256 hash for an aName template
 * @param {Object} options
 * @param {string} options.template - The template string defining name structure
 * @param {string} [options.version='v1'] - Versioning to ensure future compatibility
 * @returns {string} - SHA-256 hash representing the template's unique namespace
 */
function generateTemplateHash({ template, version = 'v1' }) {
    if (!template) {
        throw new Error('Template is required to generate a hash.')
    }

    // Combine template and versioning
    const hashInput = `${version}|${template}`

    // Generate final SHA-256 hash
    return crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex')
}
async function generateAname({
    sub,
    dictionaries = [],
    template,
    separator = '_',
    suffixLength = '3',
    seed = `${Date.now()}`,
    publicKey,
    nocache,
    entropyMode = false,
    returnAlreadyGenerated = true
} = {}) {
    const finalTemplate = template || dictionaries.map(d => Buffer.from(d).toString('base64')).join(separator)
    const nameObj = await generateAnameWithoutDupCheck({ dictionaries, template: finalTemplate, separator, suffixLength, seed, nocache, entropyMode })
    const { name } = nameObj
    const encryptedSeed = encryptMessage(seed, publicKey)
    let uniqueName = name, suffix = 0
    // do dup check

    async function multiCheckAndSet() {
        let multi = redis.multi()
        let results

        multi.SADD('aname:names', uniqueName)
        multi.HSET('aname:names:publicKey', uniqueName, publicKey)
        results = await multi.exec()  // Executes transaction atomically

        // 00 means the name was already set and the key was already set
        // 01 means the name was already set and the key was set
        // 10 means the name was set and the key was already set
        // 11 means the name was set and the key was set
        const [saddResult, hsetPublicKey] = results.map(res => res ?? 0) // Handle null results

        // If BOTH SADD and HSET failed (meaning the name already exists), return false to generate a new name
        if (saddResult === 0 && hsetPublicKey === 0) {
            return returnAlreadyGenerated
        }

        multi = redis.multi()
        multi.HSET('aname:names:seed', uniqueName, seed)
        multi.HSET('aname:names:encryptedSeed', `${uniqueName} ${publicKey}`, JSON.stringify(encryptedSeed))
        multi.SADD(`aname:names:${publicKey}`, JSON.stringify({
            name: uniqueName,
            addedAt: Date.now()
        }))

        if (sub) {
            multi.HINCRBY('aname:names:count', sub, 1)
        }

        results = await multi.exec()  // Executes transaction atomically

        if (results[3] && results[3] < 11) {
            await redis.SADD(`aname:publicKeys:${sub}`, publicKey)
        }

        return results.every(res => res >= 1)  // Returns true only if both were successfully added
    }
    while (!await multiCheckAndSet()) {
        uniqueName = `${name}-${suffix += 1}`
    }

    anameService.setDidGenerateAName(publicKey)

    const publicRecord = {
        [uniqueName]: {
            pub: publicKey,
            enc: encryptedSeed
        }
    }
    const templateHash = generateTemplateHash({ dictionaries, template: finalTemplate, version: 'v1' })

    /**
     * add publicRecord to github
     * 
    */
    anameService.add({ publicRecord, templateHash })
    if (!sub) {
        // add them to be removed later
        await redis.ZADD('aname:temporaryNames', { score: Date.now(), value: JSON.stringify({ uniqueName, seed, publicKey }) })
    }

    return {
        ...nameObj,
        name: uniqueName,
        templateHash
    }
}
async function generateAnameWithoutDupCheck(options) {
    const { template, separator, suffixLength, seed, nocache, entropyMode } = options
    const dictionaryNames = template.split(separator).map(chunk => Buffer.from(chunk, 'base64').toString('ascii'))
    const hash = crypto.createHash('sha256').update(seed).digest('hex')
    let { dictionaries } = options
    let dictionaryMetadata = {
        _seed: seed,
        _hash: hash
    }

    dictionaries = Object.fromEntries(Object.entries(dictionaries.reduce((acc, cur) => ({
        ...acc,
        ...(typeof cur === 'object' ? cur : { [cur]: [] })
    }), {}))
        .filter(([key, _]) => dictionaryNames.includes(key)))

    // Helper function to get an optimal substring size
    function getOptimalSubstringLength(dictionaryLength) {
        return Math.ceil(Math.log2(dictionaryLength) / 4)  // Calculate number of hex characters needed
    }
    function getHashSubstring(index, length) {
        // Calculate the optimal substring length based on dictionary size
        const optimalLength = getOptimalSubstringLength(length)
        const start = index * optimalLength
        const end = Math.min(start + optimalLength, hash.length)  // Ensure we don’t exceed hash length
        // Extract the corresponding portion of the hash
        return { optimalLength, index: hash.substring(start, end) }
    }
    async function updateDictionaries(url) {
        const name = basename(url)
        const uuid = uuidv5(url, uuidv5.URL)
        const multi = redis.multi()
        let cached

        if (!nocache) {
            // check cache
            cached = cache.get(uuid)
            if (cached) {
                dictionaries[name] = cached
                logger.log({ level: 'info', namespace: logNS, message: `Memory cache hit for ${url}` })
                return
            }

            // check redis cache
            cached = await unwrapRedisObject(redis.HGET('aname:dictionaries', uuid))
            if (cached) {
                dictionaries[name] = cached
                cache.set(uuid, cached)
                logger.log({ level: 'info', namespace: logNS, message: `Redis cache hit for ${url}` })
                return
            }
        }

        // pull from source
        const response = await fetch(url)

        // Check if the response is successful (status 200-299)
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
        }

        logger.log({ level: 'info', namespace: logNS, message: `Fetched ${url}` })
        const text = await response.text()
        const words = text.split(/\s/).map(word => word.trim()).filter(word => word.length)

        if (!words.length) {
            throw new Error(`Dictionary ${url} returned no valid words.`)
        }

        dictionaries[name] = words
        cache.set(uuid, words)

        multi.HSET('aname:dictionaries', uuid, JSON.stringify(words))
        multi.HSET('aname:dictionaries:map', uuid, url)

        await multi.exec()

        dictionaryMetadata[name] = {
            source: url
        }
    }

    await Promise.all(dictionaryNames.map(async (name, i) => {
        if (name.includes('https')) {
            await updateDictionaries(name)
            name = basename(name)
        }

        const length = dictionaries[name].length
        const { optimalLength, index } = getHashSubstring(i, length)

        dictionaryMetadata[name] = {
            ...dictionaryMetadata[name] || {},
            length,
            optimalLength,
            optimalLengthBase10: Math.pow(16, optimalLength),
            index
        }
    }))

    // Generate dynamic suffix length based on the suffixLength variable
    const suffixSource = entropyMode
        ? hash.slice(-suffixLength)
        : hash.slice(-Math.ceil(suffixLength * Math.log2(10) / 4))

    const decimalValue = parseInt(suffixSource, 16)
    const uniqueSuffix = suffixLength > 0 ?
        `${separator}${decimalValue.toString().padStart(suffixLength, '0').slice(-suffixLength)}`
        : ''

    // Calculate the total number of possible names
    let totalNamesPerSpace = 1, totalNamesEffective = 1

    dictionaries = Object.fromEntries(Object.entries(dictionaries).filter(([key, _]) => !key.includes('https')))
    Object.keys(dictionaries).forEach(name => {
        totalNamesPerSpace *= Math.pow(16, dictionaryMetadata[name].optimalLength)  // Calculate based on optimal substring length
        totalNamesEffective *= dictionaries[name].length
    })
    totalNamesPerSpace *= Math.pow(16, suffixLength) // Include the suffix length in the total
    totalNamesEffective *= entropyMode ? Math.pow(16, suffixLength) : Math.pow(10, suffixLength) - (suffixLength > 0 ? 1 : 0)

    const [totalNamesPerSpaceHuman, totalNamesEffectiveHuman] = [totalNamesPerSpace, totalNamesEffective].map(totalNames => Number(totalNames).toLocaleString('en-US', {
        // add suffixes for thousands, millions, and billions
        // the maximum number of decimal places to use
        maximumFractionDigits: 2,
        // specify the abbreviations to use for the suffixes
        notation: 'compact',
        compactDisplay: 'short'
    }))

    // Construct the final name dynamically based on all dictionaries
    const nameParts = Object.keys(dictionaries)
        .sort((keyA, keyB) => {
            const indexA = dictionaryNames.findIndex(name => name.endsWith(keyA))
            const indexB = dictionaryNames.findIndex(name => name.endsWith(keyB))

            return (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB)
        })
        .map((name) => {
            const index = parseInt(dictionaryMetadata[name].index, 16) % dictionaries[name].length

            return dictionaries[name][index]
        })

    // Join the parts to form the final name with the unique suffix
    const name = `${nameParts.join(separator)}${uniqueSuffix}`
    const obj = {
        source: `${NODE_ENV}:${HOSTNAME}`,
        timestamp: Date.now(),
        seed,
        name,
        totalNamesEffective,
        totalNamesEffectiveHuman,
        totalNamesPerSpace,
        totalNamesPerSpaceHuman,
        dictionaryMetadata
    }

    return obj
}

module.exports = {
    generateAname,
    lookupAname
}
