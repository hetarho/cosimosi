/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_PromptInputs */

const en_landing_walk_mirror_prompt = /** @type {(inputs: Landing_Walk_Mirror_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watch what a few more recalls of the same star do to the sky.`)
};

const ko_landing_walk_mirror_prompt = /** @type {(inputs: Landing_Walk_Mirror_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`같은 별을 몇 번 더 떠올리면 하늘이 어떻게 되는지 보세요.`)
};

/**
* | output |
* | --- |
* | "Watch what a few more recalls of the same star do to the sky." |
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