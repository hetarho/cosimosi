/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_CanceledInputs */

const en_error_canceled = /** @type {(inputs: Error_CanceledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The request was canceled.`)
};

const ko_error_canceled = /** @type {(inputs: Error_CanceledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요청이 취소되었어요.`)
};

/**
* | output |
* | --- |
* | "The request was canceled." |
*
* @param {Error_CanceledInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_canceled = /** @type {((inputs?: Error_CanceledInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_CanceledInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_canceled(inputs)
	return ko_error_canceled(inputs)
});