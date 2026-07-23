/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_Ai_ModelsInputs */

const en_admin_section_ai_models = /** @type {(inputs: Admin_Section_Ai_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI model selection`)
};

const ko_admin_section_ai_models = /** @type {(inputs: Admin_Section_Ai_ModelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AI 모델 선택`)
};

/**
* | output |
* | --- |
* | "AI model selection" |
*
* @param {Admin_Section_Ai_ModelsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_ai_models = /** @type {((inputs?: Admin_Section_Ai_ModelsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_Ai_ModelsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_ai_models(inputs)
	return ko_admin_section_ai_models(inputs)
});