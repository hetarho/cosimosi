/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_ModelInputs */

const en_admin_ai_model = /** @type {(inputs: Admin_Ai_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model`)
};

const ko_admin_ai_model = /** @type {(inputs: Admin_Ai_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모델`)
};

/**
* | output |
* | --- |
* | "Model" |
*
* @param {Admin_Ai_ModelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_model = /** @type {((inputs?: Admin_Ai_ModelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_ModelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_model(inputs)
	return ko_admin_ai_model(inputs)
});