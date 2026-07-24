/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Invalid_ArgumentInputs */

const en_error_invalid_argument = /** @type {(inputs: Error_Invalid_ArgumentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Check the information and try again.`)
};

const ko_error_invalid_argument = /** @type {(inputs: Error_Invalid_ArgumentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`입력한 내용을 확인하고 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "Check the information and try again." |
*
* @param {Error_Invalid_ArgumentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_invalid_argument = /** @type {((inputs?: Error_Invalid_ArgumentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Invalid_ArgumentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_invalid_argument(inputs)
	return ko_error_invalid_argument(inputs)
});