const { createHash } = require('crypto')
const { mapSeries } = require('async')
const url = require('url')
const { v5: uuidv5 } = require('uuid')

const { config, logger, redis } = require('../../config')

const {
    GITHUB_USER,
    GITHUB_REPO,
    GITHUB_TOKEN,
    GITHUB_APP_1_CLIENT_ID,
    GITHUB_APP_1_CLIENT_SECRET,
} = config
const logNS = 'aname-backend:github:service'

async function saveToPages(options) {
    const { Octokit } = await import('@octokit/core')
    const { url: urlParam, images } = options
    const octokit = new Octokit({
        auth: GITHUB_TOKEN,
    })
    const uuid = uuidv5(urlParam, uuidv5.URL)
    const subdir = `${url.parse(urlParam).hostname}/${uuid}`

    const hostedImages = await mapSeries(images || [], async image => {
        const base64 = image.split(',')[1]
        const hash = createHash('md5').update(base64).digest('hex')
        const path = `ughs/${subdir}/${hash}.webp`
        try {
            return await octokit.repos.createOrUpdateFileContents({
                owner: GITHUB_USER,
                repo: GITHUB_REPO,
                path,
                message: urlParam,
                content: base64,
                committer: {
                    name: GITHUB_USER,
                    email: `support@june07.com`
                }
            })
        } catch (error) {
            // ignore retrying to save the same image
            if (!/Invalid request.\n\n\"sha\" wasn't supplied./.test(error)) {
                logger.log({ level: 'error', namespace: logNS, message: error.message })
            }
        }
    })
    return hostedImages.filter(image => image).map(image => ({ url: image.data.content.download_url }))
}
async function handleOAuthCallback(code, installationId) {
    const { Octokit } = await import('@octokit/rest')
    const createOAuthUserAuth = (await import('@octokit/auth-oauth-user')).createOAuthUserAuth

    const auth = createOAuthUserAuth({
        clientId: GITHUB_APP_1_CLIENT_ID,
        clientSecret: GITHUB_APP_1_CLIENT_SECRET,
        code,
        state: installationId
    })

    let tokenAuthentication
    
    try {
        tokenAuthentication = await auth()
    } catch (error) {
        if (/4[0-9]{2}/.test(error.status)) {
            return `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_1_CLIENT_ID}&scope=repo&state=${installationId}`
        }
        throw error
    }

    const octokit = new Octokit({
        auth: tokenAuthentication.token,
    })

    const { data: user } = await octokit.rest.users.getAuthenticated()

    await redis.HSET('stellar-reflection', user.login, tokenAuthentication.token)

    return user
}

module.exports = {
    saveToPages,
    handleOAuthCallback
}