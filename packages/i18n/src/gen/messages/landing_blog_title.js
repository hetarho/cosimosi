/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Blog_TitleInputs */

const en_landing_blog_title = /** @type {(inputs: Landing_Blog_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The longer version`)
};

const ko_landing_blog_title = /** @type {(inputs: Landing_Blog_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`더 긴 이야기가 궁금하다면`)
};

/**
* | output |
* | --- |
* | "The longer version" |
*
* @param {Landing_Blog_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_blog_title = /** @type {((inputs?: Landing_Blog_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Blog_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_blog_title(inputs)
	return ko_landing_blog_title(inputs)
});