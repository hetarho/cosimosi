/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Recall_PromptInputs */

const en_landing_walk_recall_prompt = /** @type {(inputs: Landing_Walk_Recall_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pick up one of the faded ones again?`)
};

const ko_landing_walk_recall_prompt = /** @type {(inputs: Landing_Walk_Recall_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`희미해진 별 하나를 다시 떠올려 볼까요?`)
};

/**
* | output |
* | --- |
* | "Pick up one of the faded ones again?" |
*
* @param {Landing_Walk_Recall_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_recall_prompt = /** @type {((inputs?: Landing_Walk_Recall_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Recall_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_recall_prompt(inputs)
	return ko_landing_walk_recall_prompt(inputs)
});