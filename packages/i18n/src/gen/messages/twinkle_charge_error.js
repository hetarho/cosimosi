/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_ErrorInputs */

const en_twinkle_charge_error = /** @type {(inputs: Twinkle_Charge_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That didn't go through. Try again in a moment.`)
};

const ko_twinkle_charge_error = /** @type {(inputs: Twinkle_Charge_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 마치지 못했어요. 잠시 뒤 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "That didn't go through. Try again in a moment." |
*
* @param {Twinkle_Charge_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_error = /** @type {((inputs?: Twinkle_Charge_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_error(inputs)
	return ko_twinkle_charge_error(inputs)
});