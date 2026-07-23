/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Jobs_PendingInputs */

const en_admin_jobs_pending = /** @type {(inputs: Admin_Jobs_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pending`)
};

const ko_admin_jobs_pending = /** @type {(inputs: Admin_Jobs_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`대기`)
};

/**
* | output |
* | --- |
* | "Pending" |
*
* @param {Admin_Jobs_PendingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_jobs_pending = /** @type {((inputs?: Admin_Jobs_PendingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Jobs_PendingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_jobs_pending(inputs)
	return ko_admin_jobs_pending(inputs)
});