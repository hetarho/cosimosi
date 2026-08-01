/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Input_PlaceholderInputs */

const en_landing_play_input_placeholder = /** @type {(inputs: Landing_Play_Input_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A sentence worth keeping`)
};

const ko_landing_play_input_placeholder = /** @type {(inputs: Landing_Play_Input_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`남겨 두고 싶은 문장 하나`)
};

/**
* | output |
* | --- |
* | "A sentence worth keeping" |
*
* @param {Landing_Play_Input_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_input_placeholder = /** @type {((inputs?: Landing_Play_Input_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Input_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_input_placeholder(inputs)
	return ko_landing_play_input_placeholder(inputs)
});