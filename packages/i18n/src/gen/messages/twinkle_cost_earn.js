/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_EarnInputs */

const en_twinkle_cost_earn = /** @type {(inputs: Twinkle_Cost_EarnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How to gather`)
};

const ko_twinkle_cost_earn = /** @type {(inputs: Twinkle_Cost_EarnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모으는 법 보기`)
};

/**
* | output |
* | --- |
* | "How to gather" |
*
* @param {Twinkle_Cost_EarnInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_earn = /** @type {((inputs?: Twinkle_Cost_EarnInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_EarnInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_earn(inputs)
	return ko_twinkle_cost_earn(inputs)
});