/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_AiInputs */

const en_admin_section_ai = /** @type {(inputs: Admin_Section_AiInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI provider config`)
};

const ko_admin_section_ai = /** @type {(inputs: Admin_Section_AiInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 공급자 설정`)
};

/**
* | output |
* | --- |
* | "AI provider config" |
*
* @param {Admin_Section_AiInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_ai = /** @type {((inputs?: Admin_Section_AiInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_AiInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_ai(inputs)
	return ko_admin_section_ai(inputs)
});