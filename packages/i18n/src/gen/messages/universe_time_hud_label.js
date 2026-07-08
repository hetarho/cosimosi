/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Hud_LabelInputs */

const en_universe_time_hud_label = /** @type {(inputs: Universe_Time_Hud_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Universe time`)
};

const ko_universe_time_hud_label = /** @type {(inputs: Universe_Time_Hud_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 시간`)
};

/**
* | output |
* | --- |
* | "Universe time" |
*
* @param {Universe_Time_Hud_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_hud_label = /** @type {((inputs?: Universe_Time_Hud_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Hud_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_hud_label(inputs)
	return ko_universe_time_hud_label(inputs)
});