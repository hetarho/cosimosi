/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Input_LabelInputs */

const en_landing_play_input_label = /** @type {(inputs: Landing_Play_Input_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One line from today`)
};

const ko_landing_play_input_label = /** @type {(inputs: Landing_Play_Input_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘의 한 줄`)
};

/**
* | output |
* | --- |
* | "One line from today" |
*
* @param {Landing_Play_Input_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_input_label = /** @type {((inputs?: Landing_Play_Input_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Input_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_input_label(inputs)
	return ko_landing_play_input_label(inputs)
});