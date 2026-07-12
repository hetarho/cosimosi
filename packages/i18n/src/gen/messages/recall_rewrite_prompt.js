/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Rewrite_PromptInputs */

const en_recall_rewrite_prompt = /** @type {(inputs: Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write it again as you remember it now.`)
};

const ko_recall_rewrite_prompt = /** @type {(inputs: Recall_Rewrite_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그날을 지금 기억나는 대로 다시 적어 보세요.`)
};

/**
* | output |
* | --- |
* | "Write it again as you remember it now." |
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