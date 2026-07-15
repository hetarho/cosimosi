/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Balance_TitleInputs */

const en_twinkle_balance_title = /** @type {(inputs: Twinkle_Balance_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust`)
};

const ko_twinkle_balance_title = /** @type {(inputs: Twinkle_Balance_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루`)
};

/**
* | output |
* | --- |
* | "Stardust" |
*
* @param {Twinkle_Balance_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_balance_title = /** @type {((inputs?: Twinkle_Balance_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Balance_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_balance_title(inputs)
	return ko_twinkle_balance_title(inputs)
});