/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Pay_TitleInputs */

const en_twinkle_charge_pay_title = /** @type {(inputs: Twinkle_Charge_Pay_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Buy stardust`)
};

const ko_twinkle_charge_pay_title = /** @type {(inputs: Twinkle_Charge_Pay_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 사기`)
};

/**
* | output |
* | --- |
* | "Buy stardust" |
*
* @param {Twinkle_Charge_Pay_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_pay_title = /** @type {((inputs?: Twinkle_Charge_Pay_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Pay_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_pay_title(inputs)
	return ko_twinkle_charge_pay_title(inputs)
});