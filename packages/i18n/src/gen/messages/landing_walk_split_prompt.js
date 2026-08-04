/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Split_PromptInputs */

const en_landing_walk_split_prompt = /** @type {(inputs: Landing_Walk_Split_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A day rarely holds one thing. How many scenes does the entry you just read come apart into?`)
};

const ko_landing_walk_split_prompt = /** @type {(inputs: Landing_Walk_Split_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루에는 보통 여러 장면이 담겨요. 방금 읽은 일기가 몇 개의 장면으로 나뉘는지 볼까요?`)
};

/**
* | output |
* | --- |
* | "A day rarely holds one thing. How many scenes does the entry you just read come apart into?" |
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