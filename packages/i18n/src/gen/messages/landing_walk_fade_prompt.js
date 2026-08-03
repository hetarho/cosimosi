/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Fade_PromptInputs */

const en_landing_walk_fade_prompt = /** @type {(inputs: Landing_Walk_Fade_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Memory fades a little when it sits untouched. What happens if this sky is left alone for a while?`)
};

const ko_landing_walk_fade_prompt = /** @type {(inputs: Landing_Walk_Fade_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억은 가만히 두면 조금씩 흐려져요. 이 하늘도 한참 그대로 두면 어떻게 될까요?`)
};

/**
* | output |
* | --- |
* | "Memory fades a little when it sits untouched. What happens if this sky is left alone for a while?" |
*
* @param {Landing_Walk_Fade_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_fade_prompt = /** @type {((inputs?: Landing_Walk_Fade_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Fade_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_fade_prompt(inputs)
	return ko_landing_walk_fade_prompt(inputs)
});