/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Source_DbInputs */

const en_admin_ai_source_db = /** @type {(inputs: Admin_Ai_Source_DbInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Console`)
};

const ko_admin_ai_source_db = /** @type {(inputs: Admin_Ai_Source_DbInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`콘솔`)
};

/**
* | output |
* | --- |
* | "Console" |
*
* @param {Admin_Ai_Source_DbInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_source_db = /** @type {((inputs?: Admin_Ai_Source_DbInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Source_DbInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_source_db(inputs)
	return ko_admin_ai_source_db(inputs)
});