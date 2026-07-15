/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_Gist_LabelInputs */

const en_twinkle_cost_gist_label = /** @type {(inputs: Twinkle_Cost_Gist_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust to open the gist`)
};

const ko_twinkle_cost_gist_label = /** @type {(inputs: Twinkle_Cost_Gist_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지를 여는 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust to open the gist" |
*
* @param {Twinkle_Cost_Gist_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_gist_label = /** @type {((inputs?: Twinkle_Cost_Gist_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_Gist_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_gist_label(inputs)
	return ko_twinkle_cost_gist_label(inputs)
});