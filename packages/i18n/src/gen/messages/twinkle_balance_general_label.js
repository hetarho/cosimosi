/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Balance_General_LabelInputs */

const en_twinkle_balance_general_label = /** @type {(inputs: Twinkle_Balance_General_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust`)
};

const ko_twinkle_balance_general_label = /** @type {(inputs: Twinkle_Balance_General_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루`)
};

/**
* | output |
* | --- |
* | "Stardust" |
*
* @param {Twinkle_Balance_General_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_balance_general_label = /** @type {((inputs?: Twinkle_Balance_General_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Balance_General_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_balance_general_label(inputs)
	return ko_twinkle_balance_general_label(inputs)
});