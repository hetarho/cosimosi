/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_TitleInputs */

const en_twinkle_charge_title = /** @type {(inputs: Twinkle_Charge_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Get more stardust`)
};

const ko_twinkle_charge_title = /** @type {(inputs: Twinkle_Charge_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 채우기`)
};

/**
* | output |
* | --- |
* | "Get more stardust" |
*
* @param {Twinkle_Charge_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_title = /** @type {((inputs?: Twinkle_Charge_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_title(inputs)
	return ko_twinkle_charge_title(inputs)
});