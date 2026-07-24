/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Admin_ForbiddenInputs */

const en_error_admin_forbidden = /** @type {(inputs: Error_Admin_ForbiddenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You don't have permission to use the admin console.`)
};

const ko_error_admin_forbidden = /** @type {(inputs: Error_Admin_ForbiddenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`관리자 콘솔을 사용할 권한이 없어요.`)
};

/**
* | output |
* | --- |
* | "You don't have permission to use the admin console." |
*
* @param {Error_Admin_ForbiddenInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_admin_forbidden = /** @type {((inputs?: Error_Admin_ForbiddenInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Admin_ForbiddenInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_admin_forbidden(inputs)
	return ko_error_admin_forbidden(inputs)
});