/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_SourceInputs */

const en_admin_ai_source = /** @type {(inputs: Admin_Ai_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Source`)
};

const ko_admin_ai_source = /** @type {(inputs: Admin_Ai_SourceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`출처`)
};

/**
* | output |
* | --- |
* | "Source" |
*
* @param {Admin_Ai_SourceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_source = /** @type {((inputs?: Admin_Ai_SourceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_SourceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_source(inputs)
	return ko_admin_ai_source(inputs)
});