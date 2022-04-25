const Mustache = require('mustache');
const fs = require('fs/promises');

/**
 * Render data in a mustache template
 * 
 * @param {object} data An object of data to use in the template
 * @param {string} templatePath the path to the mustache template
 * @returns string
 */
exports.render = async function(data, templatePath, partials) {
    const template = await fs.readFile(templatePath, 'utf8');
    let partialTemplates = {};
    if(partials) {
        const keys = Object.keys(partials);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const partial = await fs.readFile(partials[key], 'utf8');
            partialTemplates[key] = partial;
        }
    }
    return Mustache.render(template.toString(), data, partialTemplates);
}