/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_PaymentInputs */

const en_me_stardust_reason_payment = /** @type {(inputs: Me_Stardust_Reason_PaymentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bought, once`)
};

const ko_me_stardust_reason_payment = /** @type {(inputs: Me_Stardust_Reason_PaymentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`예전에 사서`)
};

/**
* | output |
* | --- |
* | "Bought, once" |
*
* @param {Me_Stardust_Reason_PaymentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_payment = /** @type {((inputs?: Me_Stardust_Reason_PaymentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_PaymentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_payment(inputs)
	return ko_me_stardust_reason_payment(inputs)
});