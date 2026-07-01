/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Not_Found_DescriptionInputs */

const en_not_found_description = /** @type {(inputs: Not_Found_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This path leads into empty space.`)
};

const ko_not_found_description = /** @type {(inputs: Not_Found_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 길은 빈 우주로 이어져요.`)
};

/**
* | output |
* | --- |
* | "This path leads into empty space." |
*
* @param {Not_Found_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const not_found_description = /** @type {((inputs?: Not_Found_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Not_Found_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_not_found_description(inputs)
	return ko_not_found_description(inputs)
});