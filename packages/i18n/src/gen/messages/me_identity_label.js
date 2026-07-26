/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Identity_LabelInputs */

const en_me_identity_label = /** @type {(inputs: Me_Identity_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Signed in as`)
};

const ko_me_identity_label = /** @type {(inputs: Me_Identity_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`로그인한 계정`)
};

/**
* | output |
* | --- |
* | "Signed in as" |
*
* @param {Me_Identity_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_identity_label = /** @type {((inputs?: Me_Identity_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Identity_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_identity_label(inputs)
	return ko_me_identity_label(inputs)
});