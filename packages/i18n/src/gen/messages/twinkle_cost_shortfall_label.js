/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_Shortfall_LabelInputs */

const en_twinkle_cost_shortfall_label = /** @type {(inputs: Twinkle_Cost_Shortfall_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Short by`)
};

const ko_twinkle_cost_shortfall_label = /** @type {(inputs: Twinkle_Cost_Shortfall_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모자란 별가루`)
};

/**
* | output |
* | --- |
* | "Short by" |
*
* @param {Twinkle_Cost_Shortfall_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_shortfall_label = /** @type {((inputs?: Twinkle_Cost_Shortfall_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_Shortfall_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_shortfall_label(inputs)
	return ko_twinkle_cost_shortfall_label(inputs)
});