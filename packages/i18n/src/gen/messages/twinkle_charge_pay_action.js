/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Pay_ActionInputs */

const en_twinkle_charge_pay_action = /** @type {(inputs: Twinkle_Charge_Pay_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Buy`)
};

const ko_twinkle_charge_pay_action = /** @type {(inputs: Twinkle_Charge_Pay_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사기`)
};

/**
* | output |
* | --- |
* | "Buy" |
*
* @param {Twinkle_Charge_Pay_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_pay_action = /** @type {((inputs?: Twinkle_Charge_Pay_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Pay_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_pay_action(inputs)
	return ko_twinkle_charge_pay_action(inputs)
});