/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Twinkle_InsufficientInputs */

const en_error_twinkle_insufficient = /** @type {(inputs: Error_Twinkle_InsufficientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You don't have enough stardust for that.`)
};

const ko_error_twinkle_insufficient = /** @type {(inputs: Error_Twinkle_InsufficientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 작업에 필요한 별가루가 부족해요.`)
};

/**
* | output |
* | --- |
* | "You don't have enough stardust for that." |
*
* @param {Error_Twinkle_InsufficientInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_twinkle_insufficient = /** @type {((inputs?: Error_Twinkle_InsufficientInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Twinkle_InsufficientInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_twinkle_insufficient(inputs)
	return ko_error_twinkle_insufficient(inputs)
});