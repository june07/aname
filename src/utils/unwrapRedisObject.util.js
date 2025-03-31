// Unwraps a Redis promise and returns the parsed object or an error
module.exports = async (redisPromise) => {
    try {
        const result = await redisPromise

        // Try to parse the result as JSON
        try {
            return JSON.parse(result) // Parsed object
        } catch (parseError) {
            // If parsing fails, just return the raw result (could be a string)
            return result
        }
    } catch (error) {
        // Return the error object if there was an issue with the Redis promise
        return error
    }
}
