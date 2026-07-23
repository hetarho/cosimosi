/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Jobs_DeadInputs */

const en_admin_jobs_dead = /** @type {(inputs: Admin_Jobs_DeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dead-lettered`)
};

const ko_admin_jobs_dead = /** @type {(inputs: Admin_Jobs_DeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`데드레터`)
};

/**
* | output |
* | --- |
* | "Dead-lettered" |
*
* @param {Admin_Jobs_DeadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_jobs_dead = /** @type {((inputs?: Admin_Jobs_DeadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Jobs_DeadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_jobs_dead(inputs)
	return ko_admin_jobs_dead(inputs)
});