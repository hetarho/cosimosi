/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Time_LabelInputs */

const en_landing_play_time_label = /** @type {(inputs: Landing_Play_Time_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Universe time`)
};

const ko_landing_play_time_label = /** @type {(inputs: Landing_Play_Time_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 시간`)
};

/**
* | output |
* | --- |
* | "Universe time" |
*
* @param {Landing_Play_Time_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_time_label = /** @type {((inputs?: Landing_Play_Time_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Time_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_time_label(inputs)
	return ko_landing_play_time_label(inputs)
});