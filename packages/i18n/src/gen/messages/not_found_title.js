/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Not_Found_TitleInputs */

const en_not_found_title = /** @type {(inputs: Not_Found_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing orbits here`)
};

const ko_not_found_title = /** @type {(inputs: Not_Found_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여긴 아무것도 돌지 않아요`)
};

/**
* | output |
* | --- |
* | "Nothing orbits here" |
*
* @param {Not_Found_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const not_found_title = /** @type {((inputs?: Not_Found_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Not_Found_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_not_found_title(inputs)
	return ko_not_found_title(inputs)
});