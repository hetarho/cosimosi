/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Language_LabelInputs */

const en_me_language_label = /** @type {(inputs: Me_Language_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Language`)
};

const ko_me_language_label = /** @type {(inputs: Me_Language_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`언어`)
};

/**
* | output |
* | --- |
* | "Language" |
*
* @param {Me_Language_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_language_label = /** @type {((inputs?: Me_Language_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Language_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_language_label(inputs)
	return ko_me_language_label(inputs)
});