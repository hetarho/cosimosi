/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Language_Option_KoInputs */

const en_me_language_option_ko = /** @type {(inputs: Me_Language_Option_KoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한국어`)
};

const ko_me_language_option_ko = /** @type {(inputs: Me_Language_Option_KoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한국어`)
};

/**
* | output |
* | --- |
* | "한국어" |
*
* @param {Me_Language_Option_KoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_language_option_ko = /** @type {((inputs?: Me_Language_Option_KoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Language_Option_KoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_language_option_ko(inputs)
	return ko_me_language_option_ko(inputs)
});