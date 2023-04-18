import Mustache from 'mustache';
import * as footer from './footer.mustache';
import * as header from './header.mustache';

/**
 * Render data in a mustache template
 *
 * @param {object} data An object of data to use in the template
 * @param {string} template the main mustache template as a string
 * @param {{[key:string] : string} | undefined} partials name and template string
 * @returns string
 */
export async function render(data: any, template: string, partials?: {[key: string]: string }) {
  const fullPartials = {
    header: header.default,
    footer: footer.default,
    ...partials,
  };

  data = {
    logos: false,
    ...data,
  };

  return Mustache.render(template, data, fullPartials);
};