/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_ProceedInputs */

const en_twinkle_cost_proceed = /** @type {(inputs: Twinkle_Cost_ProceedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Continue`)
};

const ko_twinkle_cost_proceed = /** @type {(inputs: Twinkle_Cost_ProceedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계속하기`)
};

/**
* | output |
* | --- |
* | "Continue" |
*
* @param {Twinkle_Cost_ProceedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_proceed = /** @type {((inputs?: Twinkle_Cost_ProceedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_ProceedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_proceed(inputs)
	return ko_twinkle_cost_proceed(inputs)
});