/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Recall_Rewrite_PromptInputs */

const en_demo_recall_rewrite_prompt = /** @type {(inputs: Demo_Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fill only the faded parts as you remember them.`)
};

const ko_demo_recall_rewrite_prompt = /** @type {(inputs: Demo_Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`흐려진 부분만 지금 기억나는 대로 채워 보세요.`)
};

/**
* | output |
* | --- |
* | "Fill only the faded parts as you remember them." |
*
* @param {Demo_Recall_Rewrite_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_recall_rewrite_prompt = /** @type {((inputs?: Demo_Recall_Rewrite_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Recall_Rewrite_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_recall_rewrite_prompt(inputs)
	return ko_demo_recall_rewrite_prompt(inputs)
});