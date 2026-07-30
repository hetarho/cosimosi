/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Blog_Not_Found_TitleInputs */

const en_blog_not_found_title = /** @type {(inputs: Blog_Not_Found_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That note is not here`)
};

const ko_blog_not_found_title = /** @type {(inputs: Blog_Not_Found_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 글은 여기 없어요`)
};

/**
* | output |
* | --- |
* | "That note is not here" |
*
* @param {Blog_Not_Found_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const blog_not_found_title = /** @type {((inputs?: Blog_Not_Found_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Blog_Not_Found_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_blog_not_found_title(inputs)
	return ko_blog_not_found_title(inputs)
});