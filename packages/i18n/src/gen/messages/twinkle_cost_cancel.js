/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_CancelInputs */

const en_twinkle_cost_cancel = /** @type {(inputs: Twinkle_Cost_CancelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not now`)
};

const ko_twinkle_cost_cancel = /** @type {(inputs: Twinkle_Cost_CancelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그만두기`)
};

/**
* | output |
* | --- |
* | "Not now" |
*
* @param {Twinkle_Cost_CancelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_cancel = /** @type {((inputs?: Twinkle_Cost_CancelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_CancelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_cancel(inputs)
	return ko_twinkle_cost_cancel(inputs)
});