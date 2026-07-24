/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_UnknownInputs */

const en_error_unknown = /** @type {(inputs: Error_UnknownInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Something went wrong. Try again.`)
};

const ko_error_unknown = /** @type {(inputs: Error_UnknownInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`문제가 생겼어요. 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "Something went wrong. Try again." |
*
* @param {Error_UnknownInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_unknown = /** @type {((inputs?: Error_UnknownInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_UnknownInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_unknown(inputs)
	return ko_error_unknown(inputs)
});