/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Jobs_FailedInputs */

const en_admin_jobs_failed = /** @type {(inputs: Admin_Jobs_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed`)
};

const ko_admin_jobs_failed = /** @type {(inputs: Admin_Jobs_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`실패`)
};

/**
* | output |
* | --- |
* | "Failed" |
*
* @param {Admin_Jobs_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_jobs_failed = /** @type {((inputs?: Admin_Jobs_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Jobs_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_jobs_failed(inputs)
	return ko_admin_jobs_failed(inputs)
});