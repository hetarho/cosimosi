/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_ActionInputs */

const en_twinkle_charge_action = /** @type {(inputs: Twinkle_Charge_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Get more stardust`)
};

const ko_twinkle_charge_action = /** @type {(inputs: Twinkle_Charge_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 더 얻기`)
};

/**
* | output |
* | --- |
* | "Get more stardust" |
*
* @param {Twinkle_Charge_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_action = /** @type {((inputs?: Twinkle_Charge_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_action(inputs)
	return ko_twinkle_charge_action(inputs)
});