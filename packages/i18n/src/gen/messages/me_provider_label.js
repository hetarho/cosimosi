/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Provider_LabelInputs */

const en_me_provider_label = /** @type {(inputs: Me_Provider_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Linked ways in`)
};

const ko_me_provider_label = /** @type {(inputs: Me_Provider_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`연결된 로그인`)
};

/**
* | output |
* | --- |
* | "Linked ways in" |
*
* @param {Me_Provider_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_provider_label = /** @type {((inputs?: Me_Provider_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Provider_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_provider_label(inputs)
	return ko_me_provider_label(inputs)
});