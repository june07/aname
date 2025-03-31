const cleanPayload = payload => Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
)

module.exports = cleanPayload