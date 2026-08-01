/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Split_PromptInputs */

const en_landing_walk_split_prompt = /** @type {(inputs: Landing_Walk_Split_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A day rarely holds one thing. See how this entry divides.`)
};

const ko_landing_walk_split_prompt = /** @type {(inputs: Landing_Walk_Split_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루에는 보통 여러 장면이 담겨요. 이 일기가 어떻게 나뉘는지 직접 확인해 보세요.`)
};

/**
* | output |
* | --- |
* | "A day rarely holds one thing. See how this entry divides." |
*
* @param {Landing_Walk_Split_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_split_prompt = /** @type {((inputs?: Landing_Walk_Split_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Split_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_split_prompt(inputs)
	return ko_landing_walk_split_prompt(inputs)
});