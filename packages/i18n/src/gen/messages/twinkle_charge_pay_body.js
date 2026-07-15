/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Pay_BodyInputs */

const en_twinkle_charge_pay_body = /** @type {(inputs: Twinkle_Charge_Pay_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A pack is kept in your reserve.`)
};

const ko_twinkle_charge_pay_body = /** @type {(inputs: Twinkle_Charge_Pay_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 꾸러미를 사면 추가 별가루로 담겨요.`)
};

/**
* | output |
* | --- |
* | "A pack is kept in your reserve." |
*
* @param {Twinkle_Charge_Pay_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_pay_body = /** @type {((inputs?: Twinkle_Charge_Pay_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Pay_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_pay_body(inputs)
	return ko_twinkle_charge_pay_body(inputs)
});