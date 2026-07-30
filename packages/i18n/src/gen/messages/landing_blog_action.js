/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Blog_ActionInputs */

const en_landing_blog_action = /** @type {(inputs: Landing_Blog_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Read the notes`)
};

const ko_landing_blog_action = /** @type {(inputs: Landing_Blog_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`노트 읽기`)
};

/**
* | output |
* | --- |
* | "Read the notes" |
*
* @param {Landing_Blog_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_blog_action = /** @type {((inputs?: Landing_Blog_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Blog_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_blog_action(inputs)
	return ko_landing_blog_action(inputs)
});