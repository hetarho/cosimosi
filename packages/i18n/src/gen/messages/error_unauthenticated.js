/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_UnauthenticatedInputs */

const en_error_unauthenticated = /** @type {(inputs: Error_UnauthenticatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign in to continue.`)
};

const ko_error_unauthenticated = /** @type {(inputs: Error_UnauthenticatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계속하려면 로그인해 주세요.`)
};

/**
* | output |
* | --- |
* | "Sign in to continue." |
*
* @param {Error_UnauthenticatedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_unauthenticated = /** @type {((inputs?: Error_UnauthenticatedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_UnauthenticatedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_unauthenticated(inputs)
	return ko_error_unauthenticated(inputs)
});