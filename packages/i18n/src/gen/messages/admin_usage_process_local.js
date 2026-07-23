/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Usage_Process_LocalInputs */

const en_admin_usage_process_local = /** @type {(inputs: Admin_Usage_Process_LocalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Counts are per-process (in-memory).`)
};

const ko_admin_usage_process_local = /** @type {(inputs: Admin_Usage_Process_LocalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 프로세스 기준(인메모리) 집계예요.`)
};

/**
* | output |
* | --- |
* | "Counts are per-process (in-memory)." |
*
* @param {Admin_Usage_Process_LocalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_usage_process_local = /** @type {((inputs?: Admin_Usage_Process_LocalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Usage_Process_LocalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_usage_process_local(inputs)
	return ko_admin_usage_process_local(inputs)
});