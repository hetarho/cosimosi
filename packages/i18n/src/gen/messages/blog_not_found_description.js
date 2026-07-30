/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Blog_Not_Found_DescriptionInputs */

const en_blog_not_found_description = /** @type {(inputs: Blog_Not_Found_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The link may be old, or the address slightly off. The rest of the notes are still where they were.`)
};

const ko_blog_not_found_description = /** @type {(inputs: Blog_Not_Found_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오래된 링크이거나, 주소가 조금 어긋났을 수 있어요. 나머지 글들은 그대로 있습니다.`)
};

/**
* | output |
* | --- |
* | "The link may be old, or the address slightly off. The rest of the notes are still where they were." |
*
* @param {Blog_Not_Found_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const blog_not_found_description = /** @type {((inputs?: Blog_Not_Found_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Blog_Not_Found_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_blog_not_found_description(inputs)
	return ko_blog_not_found_description(inputs)
});