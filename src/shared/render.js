const Mustache = require('mustache');
const fs = require('fs/promises');

/**
 * Render data in a mustache template
 * 
 * @param {object} data An object of data to use in the template
 * @param {string} templatePath the path to the mustache template
 * @returns string
 */
exports.render = async function(data, templatePath) {
    const template = await fs.readFile(templatePath, 'utf8');
    return Mustache.render(template.toString(), data);
}