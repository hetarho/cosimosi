/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Jobs_DoneInputs */

const en_admin_jobs_done = /** @type {(inputs: Admin_Jobs_DoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Done`)
};

const ko_admin_jobs_done = /** @type {(inputs: Admin_Jobs_DoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`완료`)
};

/**
* | output |
* | --- |
* | "Done" |
*
* @param {Admin_Jobs_DoneInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_jobs_done = /** @type {((inputs?: Admin_Jobs_DoneInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Jobs_DoneInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_jobs_done(inputs)
	return ko_admin_jobs_done(inputs)
});