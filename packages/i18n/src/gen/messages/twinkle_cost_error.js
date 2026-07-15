/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_ErrorInputs */

const en_twinkle_cost_error = /** @type {(inputs: Twinkle_Cost_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Couldn't read the cost.`)
};

const ko_twinkle_cost_error = /** @type {(inputs: Twinkle_Cost_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`값을 불러오지 못했어요.`)
};

/**
* | output |
* | --- |
* | "Couldn't read the cost." |
*
* @param {Twinkle_Cost_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_error = /** @type {((inputs?: Twinkle_Cost_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_error(inputs)
	return ko_twinkle_cost_error(inputs)
});