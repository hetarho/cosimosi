/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_KeyInputs */

const en_admin_ai_key = /** @type {(inputs: Admin_Ai_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API key`)
};

const ko_admin_ai_key = /** @type {(inputs: Admin_Ai_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 키`)
};

/**
* | output |
* | --- |
* | "API key" |
*
* @param {Admin_Ai_KeyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_key = /** @type {((inputs?: Admin_Ai_KeyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_KeyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_key(inputs)
	return ko_admin_ai_key(inputs)
});