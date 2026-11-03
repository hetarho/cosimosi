/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Rewrite_PromptInputs */

const en_recall_rewrite_prompt = /** @type {(inputs: Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fill only the faded parts as you remember them. Reconstructing a memory is free.`)
};

const ko_recall_rewrite_prompt = /** @type {(inputs: Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`흐려진 부분만 지금 기억나는 대로 채워 보세요. 회고하기는 무료예요.`)
};

/**
* | output |
* | --- |
* | "Fill only the faded parts as you remember them. Reconstructing a memory is free." |
*
* @param {Recall_Rewrite_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_rewrite_prompt = /** @type {((inputs?: Recall_Rewrite_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Rewrite_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_rewrite_prompt(inputs)
	return ko_recall_rewrite_prompt(inputs)
});