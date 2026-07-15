/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_ChargeInputs */

const en_twinkle_cost_charge = /** @type {(inputs: Twinkle_Cost_ChargeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Get more stardust`)
};

const ko_twinkle_cost_charge = /** @type {(inputs: Twinkle_Cost_ChargeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 채우기`)
};

/**
* | output |
* | --- |
* | "Get more stardust" |
*
* @param {Twinkle_Cost_ChargeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_charge = /** @type {((inputs?: Twinkle_Cost_ChargeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_ChargeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_charge(inputs)
	return ko_twinkle_cost_charge(inputs)
});