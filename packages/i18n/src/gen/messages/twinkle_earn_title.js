/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_TitleInputs */

const en_twinkle_earn_title = /** @type {(inputs: Twinkle_Earn_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Gathering stardust`)
};

const ko_twinkle_earn_title = /** @type {(inputs: Twinkle_Earn_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 모으기`)
};

/**
* | output |
* | --- |
* | "Gathering stardust" |
*
* @param {Twinkle_Earn_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_title = /** @type {((inputs?: Twinkle_Earn_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_title(inputs)
	return ko_twinkle_earn_title(inputs)
});