/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Blog_Not_Found_ActionInputs */

const en_blog_not_found_action = /** @type {(inputs: Blog_Not_Found_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to the notes`)
};

const ko_blog_not_found_action = /** @type {(inputs: Blog_Not_Found_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`노트 목록으로`)
};

/**
* | output |
* | --- |
* | "Back to the notes" |
*
* @param {Blog_Not_Found_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const blog_not_found_action = /** @type {((inputs?: Blog_Not_Found_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Blog_Not_Found_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_blog_not_found_action(inputs)
	return ko_blog_not_found_action(inputs)
});