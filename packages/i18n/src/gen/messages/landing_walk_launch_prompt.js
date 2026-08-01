/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Launch_PromptInputs */

const en_landing_walk_launch_prompt = /** @type {(inputs: Landing_Walk_Launch_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Now send these scenes up into the night.`)
};

const ko_landing_walk_launch_prompt = /** @type {(inputs: Landing_Walk_Launch_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이제 이 장면들을 밤하늘에 띄울 차례예요.`)
};

/**
* | output |
* | --- |
* | "Now send these scenes up into the night." |
*
* @param {Landing_Walk_Launch_PromptInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_launch_prompt = /** @type {((inputs?: Landing_Walk_Launch_PromptInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Launch_PromptInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_launch_prompt(inputs)
	return ko_landing_walk_launch_prompt(inputs)
});