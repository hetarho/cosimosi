/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Permission_DeniedInputs */

const en_error_permission_denied = /** @type {(inputs: Error_Permission_DeniedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You don't have permission to do that.`)
};

const ko_error_permission_denied = /** @type {(inputs: Error_Permission_DeniedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 작업을 할 권한이 없어요.`)
};

/**
* | output |
* | --- |
* | "You don't have permission to do that." |
*
* @param {Error_Permission_DeniedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_permission_denied = /** @type {((inputs?: Error_Permission_DeniedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Permission_DeniedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_permission_denied(inputs)
	return ko_error_permission_denied(inputs)
});