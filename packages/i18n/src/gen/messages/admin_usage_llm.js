/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Usage_LlmInputs */

const en_admin_usage_llm = /** @type {(inputs: Admin_Usage_LlmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`LLM calls`)
};

const ko_admin_usage_llm = /** @type {(inputs: Admin_Usage_LlmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`LLM 호출`)
};

/**
* | output |
* | --- |
* | "LLM calls" |
*
* @param {Admin_Usage_LlmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_usage_llm = /** @type {((inputs?: Admin_Usage_LlmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Usage_LlmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_usage_llm(inputs)
	return ko_admin_usage_llm(inputs)
});