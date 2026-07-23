/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Capability_LlmInputs */

const en_admin_ai_capability_llm = /** @type {(inputs: Admin_Ai_Capability_LlmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`LLM`)
};

const ko_admin_ai_capability_llm = /** @type {(inputs: Admin_Ai_Capability_LlmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`LLM`)
};

/**
* | output |
* | --- |
* | "LLM" |
*
* @param {Admin_Ai_Capability_LlmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_capability_llm = /** @type {((inputs?: Admin_Ai_Capability_LlmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Capability_LlmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_capability_llm(inputs)
	return ko_admin_ai_capability_llm(inputs)
});