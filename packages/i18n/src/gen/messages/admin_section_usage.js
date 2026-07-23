/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_UsageInputs */

const en_admin_section_usage = /** @type {(inputs: Admin_Section_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI usage`)
};

const ko_admin_section_usage = /** @type {(inputs: Admin_Section_UsageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 사용량`)
};

/**
* | output |
* | --- |
* | "AI usage" |
*
* @param {Admin_Section_UsageInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_usage = /** @type {((inputs?: Admin_Section_UsageInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_UsageInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_usage(inputs)
	return ko_admin_section_usage(inputs)
});