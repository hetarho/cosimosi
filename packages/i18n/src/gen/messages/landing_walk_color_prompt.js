/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Color_PromptInputs */

const en_landing_walk_color_prompt = /** @type {(inputs: Landing_Walk_Color_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What happens after a few more days of writing?`)
};

const ko_landing_walk_color_prompt = /** @type {(inputs: Landing_Walk_Color_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`며칠 더 쓰면 하늘이 어떻게 되는지 볼까요?`)
};

/**
* | output |
* | --- |
* | "What happens after a few more days of writing?" |
*
* @param {Landing_Walk_Color_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_color_prompt = /** @type {((inputs?: Landing_Walk_Color_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Color_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_color_prompt(inputs)
	return ko_landing_walk_color_prompt(inputs)
});