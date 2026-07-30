/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Locale_KoInputs */

const en_landing_locale_ko = /** @type {(inputs: Landing_Locale_KoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`KO`)
};

const ko_landing_locale_ko = /** @type {(inputs: Landing_Locale_KoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한국어`)
};

/**
* | output |
* | --- |
* | "KO" |
*
* @param {Landing_Locale_KoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_locale_ko = /** @type {((inputs?: Landing_Locale_KoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Locale_KoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_locale_ko(inputs)
	return ko_landing_locale_ko(inputs)
});