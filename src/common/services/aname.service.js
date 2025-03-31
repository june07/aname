const sodium = require('libsodium-wrappers')
const { logger, config, esm: esmPromise, redis } = require('../../config')
const getBitOffset = require('../../utils/getBitOffset.util')
const cacheService = require('../../common/services/cache.service')
const roleUtils = require('../../common/utils/role.util')
const unwrapRedisObject = require('../../utils/unwrapRedisObject.util')
const { v4: uuidv4 } = require('uuid')
let cache = cacheService().then(modules => cache = modules).catch(e => { throw e })
let esm = esmPromise.then(modules => esm = modules).catch(e => { throw e })

const {
    DOMAIN,
    GITHUB_USER,
    GITHUB_PAT,
    GITHUB_ORG,
    KEYCLOAK_URL,
    KEYCLOAK_REALM,
    ANAME_API_KEY_ANAME,
    KEYCLOAK_REALM_JUNE07,
    KEYCLOAK_ADMIN_CLIENT_ID_BANC,
    KEYCLOAK_ADMIN_CLIENT_SECRET_BANC
} = config
const logNS = 'aname-backend:aname:service'

function getDidGenerateAName(publicKey) {
    return redis.GETBIT('aname:didGenerateAName', getBitOffset(publicKey))
}
async function setDidGenerateAName(publicKey) {
    if (await cache.get(`aname:didGenerateAName:${publicKey}`)) {
        return
    }

    redis.SETBIT('aname:didGenerateAName', getBitOffset(publicKey), 1)
}
function getIndexes() {
    return [
        '00', '10', '20', '30', '40', '50', '60', '70', '80', '90',
        'al', 'az', 'bl', 'bz', 'cl', 'cz', 'dl', 'dz',
        'el', 'ez', 'fl', 'fz', 'gl', 'gz', 'hl', 'hz',
        'il', 'iz', 'jl', 'jz', 'kl', 'kz', 'll', 'lz',
        'ml', 'mz', 'nl', 'nz', 'ol', 'oz', 'pl', 'pz',
        'ql', 'qz', 'rl', 'rz', 'sl', 'sz', 'tl', 'tz',
        'ul', 'uz', 'vl', 'vz', 'wl', 'wz', 'xl', 'xz',
        'yl', 'yz', 'zl', 'zz'
    ]
}
function getIndexCName(index) {
    return `${index}.aname.june07.com`
}
function getIndexForName(name) {
    const lowerCase = name.toLowerCase()
    const firstChar = lowerCase.slice(0, 1)
    const secondChar = lowerCase.slice(1, 2)

    if (!isNaN(Number(firstChar))) {
        return `${firstChar}0`
    }

    const index = !secondChar ? `${firstChar}l` : `${firstChar}${secondChar < 'm' ? 'l' : 'z'}`
    return index
}
async function copyRepoBranchProtectionRules(repo, templateRepo) {
    const MyOctokit = esm.Octokit.plugin(esm.retry)
    const octokit = new MyOctokit({
        auth: GITHUB_PAT
    })

    function adjustProtectionSettings(obj) {
        if (Array.isArray(obj)) {
            return obj.map(adjustProtectionSettings)
        } else if (obj && typeof obj === 'object') {
            return Object.keys(obj).reduce((acc, key) => {
                if (key === 'url') {
                    return acc // Skip URL fields
                }
                if (typeof obj[key] === 'object' && obj[key].enabled !== undefined) {
                    acc[key] = obj[key].enabled
                } else {
                    acc[key] = adjustProtectionSettings(obj[key])
                }
                return acc
            }, {})
        }
        return obj
    }

    try {
        // Get branch protection rules from the template repository
        const { data: templateProtection } = await octokit.repos.getBranchProtection({
            owner: GITHUB_ORG,
            repo: templateRepo,
            branch: 'main',
        })

        const protectionSettings = {
            required_status_checks: null,
            restrictions: null,
            ...adjustProtectionSettings(templateProtection)
        }

        // Apply branch protection rules to each new repository
        await octokit.repos.updateBranchProtection({
            owner: GITHUB_ORG,
            repo,
            branch: 'main',
            ...protectionSettings,
        })
    } catch (error) {
        logger.log({ level: 'error', namespace: logNS, message: error.message })
    }
}
// Function to encrypt the secret value using GitHub's public key
async function encryptSecret(publicKey, secretValue) {
    await sodium.ready
    // Convert the secret and key to a Uint8Array.
    let binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL)
    let binsec = sodium.from_string(secretValue)

    // Encrypt the secret using libsodium
    let encBytes = sodium.crypto_box_seal(binsec, binkey)

    // Convert the encrypted Uint8Array to Base64
    let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)

    return output
}
async function add(options, setupRepo = false) {
    const { publicRecord, templateHash } = options
    const name = Object.keys(publicRecord)[0]
    const MyOctokit = esm.Octokit.plugin(esm.retry)
    const octokit = new MyOctokit({
        auth: GITHUB_PAT
    })

    const index = getIndexForName(name)
    const cname = getIndexCName(index)
    const templateRepo = 'aname-template'
    const repo = `aname-${index}`
    const subdir = `public/n/${templateHash}`
    const path = `${subdir}/${name}.json`

    async function retryRequest(fn, description, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn()
            } catch (error) {
                logger.log({ level: 'error', namespace: logNS, message: `${description} failed (attempt ${attempt}): ${error.message}` })

                if (attempt === maxRetries) {
                    logger.log({ level: 'error', namespace: logNS, message: `Max retries reached for ${description}. Moving on...` })
                    return
                }
                await new Promise(res => setTimeout(res, 30000)) // Wait before retrying
            }
        }
    }
    async function getRepoContent(repo, retry = 0) {
        try {
            // Get the SHA of the directory to delete
            const { data: contents } = await octokit.repos.getContent({
                owner: GITHUB_ORG,
                repo,
                path: 'public/n',
            })
            return contents
        } catch (error) {
            if (retry < 11) {
                await new Promise(resolve => setTimeout(resolve, 30000 * retry))
                return getRepoContent(repo, retry + 1)
            }
            throw error
        }
    }
    // Function to format objects into JavaScript object literals with unquoted keys
    const formatObject = (obj) => {
        return Object.entries(obj)
            .map(([key, value]) => {
                // Check if the value is an array and format it accordingly
                const formattedValue = Array.isArray(value)
                    ? `[ ${formatArray(value)} ]`
                    : typeof value === 'object' && value !== null
                        ? `{ ${formatObject(value)} }`
                        : typeof value === 'string'
                            ? `'${value}'`
                            : value
                // Format the key-value pair
                return `${key}: ${formattedValue}`
            })
            .join(',\n')
    }
    try {
        await octokit.repos.createOrUpdateFileContents({
            owner: GITHUB_ORG,
            repo,
            path,
            message: `Updated by Aname Service`,
            content: Buffer.from(JSON.stringify(publicRecord)).toString('base64'),
            committer: {
                name: GITHUB_USER,
                email: `support@june07.com`
            }
        })
        if (setupRepo) {
            try {
                await retryRequest(() => octokit.request(`PUT /orgs/${GITHUB_ORG}/actions/permissions/workflow`, {
                    owner: GITHUB_ORG,
                    repo,
                    default_workflow_permissions: 'write',
                    can_approve_pull_request_reviews: true,
                    headers: { 'X-GitHub-Api-Version': '2022-11-28' }
                }), "Setting workflow permissions")

                await retryRequest(() => octokit.rest.repos.createPagesSite({
                    owner: GITHUB_ORG,
                    repo,
                    source: { branch: 'main' },
                    build_type: 'workflow'
                }), "Creating GitHub Pages site")

                await retryRequest(() => octokit.rest.repos.updateInformationAboutPagesSite({
                    owner: GITHUB_ORG,
                    repo,
                    cname
                }), "Updating GitHub Pages CNAME")

                await retryRequest(() => octokit.rest.repos.updateInformationAboutPagesSite({
                    owner: GITHUB_ORG,
                    repo,
                    https_enforced: true
                }), "Enforcing HTTPS for GitHub Pages")

                await retryRequest(() => copyRepoBranchProtectionRules(repo, templateRepo), "Copying branch protection rules")

                const { data: publicKey } = await retryRequest(() => octokit.rest.actions.getRepoPublicKey({
                    owner: GITHUB_ORG,
                    repo
                }), "Fetching repo public key")

                if (publicKey) {
                    const encrypted = await encryptSecret(publicKey.key, GITHUB_PAT)

                    await retryRequest(() => octokit.rest.actions.createOrUpdateRepoSecret({
                        owner: GITHUB_ORG,
                        repo,
                        secret_name: 'PAT',
                        encrypted_value: encrypted,
                        key_id: publicKey.key_id
                    }), "Creating/updating repo secret")
                }

                await retryRequest(() => octokit.actions.createWorkflowDispatch({
                    owner: GITHUB_ORG,
                    repo,
                    workflow_id: 'deploy-pages.yml',
                    ref: 'main',
                }), "Triggering deploy workflow")

            } catch (error) {
                logger.log({ level: 'error', namespace: logNS, message: error.message })
            }
        }
    } catch (error) {
        // ignore retrying to save the same image
        if (!/Invalid request.\n\n\"sha\" wasn't supplied./.test(error)) {
            logger.log({ level: 'error', namespace: logNS, message: error.message })
        }
        // if the repo doesn't exist, create it
        if (error.status === 404) {
            try {
                await octokit.repos.createUsingTemplate({
                    template_owner: GITHUB_ORG,
                    template_repo: 'aname-template',
                    owner: GITHUB_ORG,
                    name: repo
                })

                const contents = await getRepoContent(repo)

                await Promise.all(contents.map(async item => {
                    if (item.type === 'file') {
                        // Delete file
                        return octokit.repos.deleteFile({
                            owner: GITHUB_ORG,
                            repo,
                            path: item.path,
                            message: `Deleting file ${item.path}`,
                            sha: item.sha
                        })
                    }
                }))

                return await add(options, true)
            } catch (error) {
                logger.log({ level: 'error', namespace: logNS, message: error.message })
            }
        }
        throw error
    }
}
async function stats(auth) {
    const { sub } = auth
    const role = auth.resource_access['ai'].roles.find(role => role.startsWith('aname'))
    const max = roleUtils.getRoleLimits({ role, limit: 'names' })

    const count = new Promise(async resolve => {
        let count

        count = await cache.get(`aname:names:count:${sub}`)

        if (count) resolve({ count: Number(count) })

        count = await redis.HGET('aname:names:count', sub) || 0

        if (count) {
            await cache.set(`aname:names:count:${sub}`, count, { EX: 60 })
            resolve({ count: Number(count) })
        }
        resolve()
    })

    const names = new Promise(async resolve => {
        const publicKeysPerUser = (await redis.SMEMBERS(`aname:publicKeys:${sub}`)) || []

        const names = await Promise.all(
            publicKeysPerUser.map(async publicKey => {
                const rawNames = await redis.SMEMBERS(`aname:names:${publicKey}`)
                return rawNames.map(name => JSON.parse(name)) // Properly parse each element
            })
        )

        resolve({ names: names.flat() })
    })

    const stats = {
        max,
        ...(await Promise.all([
            count,
            names,
        ])).reduce((acc, value) => ({ ...acc, ...value }), {})
    }

    if (stats.names.length !== stats.count) {
        redis.HSET('aname:names:count', sub, stats.names.length)
    }

    return stats
}

// Ensure the user doesn't have an API key yet
async function getApiKey(auth) {
    const { sub } = auth
    const role = auth.resource_access['ai'].roles.find(role => role.startsWith('aname'))

    try {
        // Check if the user already has an API key (prevention of duplicate keys)
        let key = await unwrapRedisObject(redis.HGET('aname:apikeys', sub))

        if (key) {
            return key
        }

        key = uuidv4()

        for (let retryCount = 0; retryCount < 3; retryCount++) {
            if (!await redis.SISMEMBER('aname:apikeys:all', key)) {
                break // Found unique key, exit loop
            }
            key = uuidv4() // Generate a new key if a duplicate is found
        }

        const expiresInDays = 365 // 1 year expiration time
        const expirationTimestamp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000 // Expiration timestamp in milliseconds

        // Store API key in Redis under the user's sub
        const apiKeyData = {
            key, // Store the API key
            role,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(expirationTimestamp).toISOString(), // Set the expiration time
        }

        const multi = redis.multi()
        multi.SADD('aname:apikeys:all', key)
        multi.SADD(`aname:apikeys:${sub}`, key)
        multi.HSET('aname:apikeys:keysub', key, sub)
        multi.HSET('aname:apikeys', key, JSON.stringify(apiKeyData))  // Store user data under 'user-api-keys' hash
        const results = await multi.exec()

        // Check if all operations were successful (they should return non-null values)
        if (results.some(result => result === null)) {
            throw new Error('Failed to execute one or more Redis operations')
        }

        return apiKeyData // Return the generated API key
    } catch (error) {
        logger.log({ level: 'error', namespace: logNS, message: 'Error generating API key:', error })
        throw new Error('Failed to generate API key')
    }
}
async function aname(auth, publicKey) {
    const { sub, createdAt } = auth
    let cached

    async function _getKeycloakAccessToken(options = {}) {
        const {
            realm,
            clientId,
            clientSecret
        } = options
        try {
            const currentTime = Date.now()

            // Check if the cached access token is still valid
            if (cachedAccessToken && currentTime < accessTokenExpiry) {
                return cachedAccessToken
            }

            // Fetch a new access token
            const tokenResponse = await async.got.post(`${KEYCLOAK_URL}/realms/${realm}/protocol/openid-connect/token`, {
                form: {
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }
            }).json()

            // Cache the new access token and its expiry time
            cachedAccessToken = tokenResponse.access_token
            accessTokenExpiry = currentTime + (tokenResponse.expires_in * 1000) // Convert expires_in to milliseconds

            return cachedAccessToken
        } catch (error) {
            logger.log({ level: 'error', namespace: logNS, message: `Error retrieving Keycloak access token: ${error.message}` })
            throw error // Re-throw the error for handling at the caller's level
        }
    }
    async function updateUserAttribute(userId, name, value, options = {}) {
        const { property } = options
        // /banc|aname/.test(property) is sort of a hack since banc and aname use the same keycloak realm/admin client
        const realm = /banc|aname/.test(property) ? KEYCLOAK_REALM_JUNE07 : KEYCLOAK_REALM
        const keycloakOptions = /banc|aname/.test(property) ? {
            realm,
            clientId: KEYCLOAK_ADMIN_CLIENT_ID_BANC,
            clientSecret: KEYCLOAK_ADMIN_CLIENT_SECRET_BANC
        } : {}

        try {
            // Step 1: Get a token from Keycloak
            const accessToken = await _getKeycloakAccessToken(keycloakOptions)

            const getUserAttributeResponse = await async.got.get(
                `${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    responseType: 'json'
                }
            )

            // Get the current user attributes
            const currentUserAttributes = getUserAttributeResponse.body.attributes

            // Step 2: Update the user attribute
            const updateUserAttributeResponse = await async.got.put(
                `${KEYCLOAK_URL}/admin/realms/${realm}/users/${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    json: {
                        attributes: {
                            ...currentUserAttributes,
                            [`${name}`]: value, // Replace with the value you want to set
                        },
                    }
                }
            ).json()

            logger.log({ level: 'info', namespace: logNS, message: updateUserAttributeResponse.body })
        } catch (error) {
            logger.log({ level: 'error', namespace: logNS, message: `Error updating user attribute: ${error.message}` })
        }
    }

    cached = await unwrapRedisObject(redis.HGET('aname:aname', sub))

    if (cached) {
        return cached
    }

    try {
        await fetch(`https://${DOMAIN}/v1/ai/aname?seed=${createdAt}${sub}` +
            `&suffixLength=0` +
            `&dictionaries=${encodeURIComponent(JSON.stringify([
                'https://github.june07.com/dictionary/adjs.txt',
                'https://github.june07.com/dictionary/colors.txt',
                'https://github.june07.com/dictionary/nouns.txt']))}` +
            `&publicKey=${publicKey}`, {
            headers: {
                'x-api-key': ANAME_API_KEY_ANAME
            }
        })
            .then(response => response.json())
            .then(async data => {
                if (data.error) {
                    throw new Error(data.error)
                }
                await redis.HSET('aname:aname', sub, JSON.stringify(data))
                await updateUserAttribute(sub, 'anameUsername', data.name || data.username, { property: 'aname' })
                return data
            })
            .catch(error => {
                console.error('Error fetching data:', error)
            })
    } catch (error) {
        logger.log({ level: 'error', namespace: logNS, message: error })
        throw error
    }
}

const anameService = {
    add,
    getApiKey,
    getIndexes,
    getIndexCName,
    getDidGenerateAName,
    setDidGenerateAName,
    stats,
    aname
}

globalThis.anameService = anameService

module.exports = anameService