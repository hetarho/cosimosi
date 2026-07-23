/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_SavedInputs */

const en_admin_ai_saved = /** @type {(inputs: Admin_Ai_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Saved`)
};

const ko_admin_ai_saved = /** @type {(inputs: Admin_Ai_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`저장됨`)
};

/**
* | output |
* | --- |
* | "Saved" |
*
* @param {Admin_Ai_SavedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_saved = /** @type {((inputs?: Admin_Ai_SavedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_SavedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_saved(inputs)
	return ko_admin_ai_saved(inputs)
});