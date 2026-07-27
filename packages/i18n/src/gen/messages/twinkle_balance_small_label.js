/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Balance_Small_LabelInputs */

const en_twinkle_balance_small_label = /** @type {(inputs: Twinkle_Balance_Small_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Small stardust`)
};

const ko_twinkle_balance_small_label = /** @type {(inputs: Twinkle_Balance_Small_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`작은 별가루`)
};

/**
* | output |
* | --- |
* | "Small stardust" |
*
* @param {Twinkle_Balance_Small_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_balance_small_label = /** @type {((inputs?: Twinkle_Balance_Small_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Balance_Small_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_balance_small_label(inputs)
	return ko_twinkle_balance_small_label(inputs)
});