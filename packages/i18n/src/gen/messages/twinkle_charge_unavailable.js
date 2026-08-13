/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_UnavailableInputs */

const en_twinkle_charge_unavailable = /** @type {(inputs: Twinkle_Charge_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not ready yet.`)
};

const ko_twinkle_charge_unavailable = /** @type {(inputs: Twinkle_Charge_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 준비 중이에요.`)
};

/**
* | output |
* | --- |
* | "Not ready yet." |
*
* @param {Twinkle_Charge_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_unavailable = /** @type {((inputs?: Twinkle_Charge_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_unavailable(inputs)
	return ko_twinkle_charge_unavailable(inputs)
});