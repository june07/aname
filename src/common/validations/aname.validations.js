const Joi = require('joi')

const anamePublic = {
    params: {
        publicKey: Joi.string()
            .length(64) // Must be exactly 64 characters
            .hex() // Must be hexadecimal (0-9, a-f)
            .required(), // Ensure it is provided
    }
}
const aname = {
    query: Joi.object().keys({
        dictionaries: Joi.alternatives().try(
            Joi.object().pattern(
                Joi.string(), // Key: dictionary name (a string),
                Joi.string().pattern(/^[^,]+(,[^,]+)*$/) // Value: a CSV list (string with comma-separated values)
            ),
            Joi.string().custom((value, helpers) => {
                try {
                    const parsed = JSON.parse(value)

                    if (!Array.isArray(parsed)) {
                        return helpers.error("any.invalid")
                    }
                    if (!parsed.length) {
                        return helpers.error("any.invalid")
                    }
                } catch {
                    return helpers.error("any.invalid")
                }
            }, "JSON Parsing")
        ),
        template: Joi.string(),
        separator: Joi.string().pattern(/^[-_:.|,;+# ]$/),
        suffixLength: Joi.number(),
        seed: Joi.string(),
        publicKey: Joi.string()
            .length(64) // Must be exactly 64 characters
            .hex() // Must be hexadecimal (0-9, a-f)
            .required(), // Ensure it is provided
        nocache: Joi.boolean()
            .truthy(1, '1', 'true')
            .falsy(0, '0', 'false'),
        entropyMode: Joi.boolean()
            .truthy(1, '1', 'true')
            .falsy(0, '0', 'false')
    })
}
const lookupAname = {
    params: Joi.object().keys({
        name: Joi.string().required(),
    }),
    query: Joi.object().keys({
        publicKey: Joi.string()
            .length(64) // Must be exactly 64 characters
            .hex() // Must be hexadecimal (0-9, a-f)
            .required(), // Ensure it is provided
    })
}

module.exports = {
    aname,
    lookupAname,
    public: {
        aname: anamePublic
    }
}
