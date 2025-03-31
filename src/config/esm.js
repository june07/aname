module.exports = (async () => {
    const { got } = await import('got')
    const { nanoid, customAlphabet } = await import('nanoid')
    const { x25519 } = await import('@noble/curves/ed25519')
    const { retry } = await import('@octokit/plugin-retry')
    const { Octokit } = await import('@octokit/rest')
    const { Queue } = await import('bullmq')
    const Keyv = await import('keyv')
    const KeyvValkey = await import('@keyv/valkey')

    return {
        got,
        nanoid,
        customAlphabet,
        x25519,
        retry,
        Octokit,
        Queue,
        Keyv,
        KeyvValkey
    }
})()