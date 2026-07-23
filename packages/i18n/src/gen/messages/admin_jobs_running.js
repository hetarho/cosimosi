/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Jobs_RunningInputs */

const en_admin_jobs_running = /** @type {(inputs: Admin_Jobs_RunningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Running`)
};

const ko_admin_jobs_running = /** @type {(inputs: Admin_Jobs_RunningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`실행 중`)
};

/**
* | output |
* | --- |
* | "Running" |
*
* @param {Admin_Jobs_RunningInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_jobs_running = /** @type {((inputs?: Admin_Jobs_RunningInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Jobs_RunningInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_jobs_running(inputs)
	return ko_admin_jobs_running(inputs)
});