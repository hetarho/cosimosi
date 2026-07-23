/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_JobsInputs */

const en_admin_section_jobs = /** @type {(inputs: Admin_Section_JobsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Job queue health`)
};

const ko_admin_section_jobs = /** @type {(inputs: Admin_Section_JobsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`작업 큐 상태`)
};

/**
* | output |
* | --- |
* | "Job queue health" |
*
* @param {Admin_Section_JobsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_jobs = /** @type {((inputs?: Admin_Section_JobsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_JobsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_jobs(inputs)
	return ko_admin_section_jobs(inputs)
});