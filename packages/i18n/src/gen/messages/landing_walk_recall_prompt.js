/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Recall_PromptInputs */

const en_landing_walk_recall_prompt = /** @type {(inputs: Landing_Walk_Recall_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Even a faded memory returns the moment it is recalled. Here is one of the dim ones on its way back.`)
};

const ko_landing_walk_recall_prompt = /** @type {(inputs: Landing_Walk_Recall_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`흐려진 기억도 다시 떠올리는 순간 돌아와요. 희미해진 별 하나를 회고해 볼까요?`)
};

/**
* | output |
* | --- |
* | "Even a faded memory returns the moment it is recalled. Here is one of the dim ones on its way back." |
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