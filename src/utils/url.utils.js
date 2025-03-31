function getTLDFromURL(urlString) {
    const parsedUrl = new URL(urlString)
    const hostname = parsedUrl.hostname
    const tldMatch = hostname.match(/\.[^.]+$/) // Match the last occurrence of a dot followed by one or more non-dot characters
    if (tldMatch) {
        return tldMatch[0].slice(1) // Remove the leading dot from the TLD
    } else {
        return null // No TLD found
    }
}
function getDomainFromURL(urlString, levels = 2) {
    const parsedUrl = new URL(urlString)
    return parsedUrl.hostname.split('.').slice(-levels).join('.')
}
function getPathFromURL(urlString) {
    const parsedUrl = new URL(urlString)
    return parsedUrl.pathname
}
function getOriginFromURL(urlString) {
    const parsedUrl = new URL(urlString)
    return parsedUrl.origin
}

module.exports = {
    getOriginFromURL,
    getPathFromURL,
    getDomainFromURL,
    getTLDFromURL
}