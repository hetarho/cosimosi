/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Launch_PromptInputs */

const en_landing_walk_launch_prompt = /** @type {(inputs: Landing_Walk_Launch_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each scene becomes a star of its own. These three are on their way up into the night.`)
};

const ko_landing_walk_launch_prompt = /** @type {(inputs: Landing_Walk_Launch_PromptInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장면은 하나씩 별이 돼요. 이제 세 장면이 밤하늘로 올라가요.`)
};

/**
* | output |
* | --- |
* | "Each scene becomes a star of its own. These three are on their way up into the night." |
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