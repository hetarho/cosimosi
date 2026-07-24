/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Not_FoundInputs */

const en_error_not_found = /** @type {(inputs: Error_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The requested item could not be found.`)
};

const ko_error_not_found = /** @type {(inputs: Error_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요청한 항목을 찾지 못했어요.`)
};

/**
* | output |
* | --- |
* | "The requested item could not be found." |
*
* @param {Error_Not_FoundInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_not_found = /** @type {((inputs?: Error_Not_FoundInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Not_FoundInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_not_found(inputs)
	return ko_error_not_found(inputs)
});