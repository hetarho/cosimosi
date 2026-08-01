/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Fade_PromptInputs */

const en_landing_walk_fade_prompt = /** @type {(inputs: Landing_Walk_Fade_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`And if it were all left alone for a while?`)
};

const ko_landing_walk_fade_prompt = /** @type {(inputs: Landing_Walk_Fade_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이대로 한참 두면 어떻게 될까요?`)
};

/**
* | output |
* | --- |
* | "And if it were all left alone for a while?" |
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