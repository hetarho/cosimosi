/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Provider_GoogleInputs */

const en_me_provider_google = /** @type {(inputs: Me_Provider_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google`)
};

const ko_me_provider_google = /** @type {(inputs: Me_Provider_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google`)
};

/**
* | output |
* | --- |
* | "Google" |
*
* @param {Me_Provider_GoogleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_provider_google = /** @type {((inputs?: Me_Provider_GoogleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Provider_GoogleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_provider_google(inputs)
	return ko_me_provider_google(inputs)
});