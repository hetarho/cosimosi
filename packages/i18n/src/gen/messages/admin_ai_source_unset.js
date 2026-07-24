/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Source_UnsetInputs */

const en_admin_ai_source_unset = /** @type {(inputs: Admin_Ai_Source_UnsetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not set`)
};

const ko_admin_ai_source_unset = /** @type {(inputs: Admin_Ai_Source_UnsetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`설정 안 됨`)
};

/**
* | output |
* | --- |
* | "Not set" |
*
* @param {Admin_Ai_Source_UnsetInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_source_unset = /** @type {((inputs?: Admin_Ai_Source_UnsetInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Source_UnsetInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_source_unset(inputs)
	return ko_admin_ai_source_unset(inputs)
});