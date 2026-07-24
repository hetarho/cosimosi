/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_UnavailableInputs */

const en_error_unavailable = /** @type {(inputs: Error_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The service is temporarily unavailable. Try again shortly.`)
};

const ko_error_unavailable = /** @type {(inputs: Error_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`서비스를 잠시 사용할 수 없어요. 곧 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "The service is temporarily unavailable. Try again shortly." |
*
* @param {Error_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_unavailable = /** @type {((inputs?: Error_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_unavailable(inputs)
	return ko_error_unavailable(inputs)
});