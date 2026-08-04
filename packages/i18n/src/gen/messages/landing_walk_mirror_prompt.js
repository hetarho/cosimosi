/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_PromptInputs */

const en_landing_walk_mirror_prompt = /** @type {(inputs: Landing_Walk_Mirror_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What you often return to holds more of the sky. Here is what a few more recalls of the same star do.`)
};

const ko_landing_walk_mirror_prompt = /** @type {(inputs: Landing_Walk_Mirror_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`자주 돌아본 기억은 하늘에서 더 넓은 자리를 가져요. 같은 별을 몇 번 더 떠올리면 어떻게 될까요?`)
};

/**
* | output |
* | --- |
* | "What you often return to holds more of the sky. Here is what a few more recalls of the same star do." |
*
* @param {Landing_Walk_Mirror_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_mirror_prompt = /** @type {((inputs?: Landing_Walk_Mirror_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Mirror_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_mirror_prompt(inputs)
	return ko_landing_walk_mirror_prompt(inputs)
});