/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Locale_LabelInputs */

const en_landing_locale_label = /** @type {(inputs: Landing_Locale_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Language`)
};

const ko_landing_locale_label = /** @type {(inputs: Landing_Locale_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`언어`)
};

/**
* | output |
* | --- |
* | "Language" |
*
* @param {Landing_Locale_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_locale_label = /** @type {((inputs?: Landing_Locale_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Locale_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_locale_label(inputs)
	return ko_landing_locale_label(inputs)
});