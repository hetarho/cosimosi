/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Time_Hud_LabelInputs */

const en_demo_time_hud_label = /** @type {(inputs: Demo_Time_Hud_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Universe time`)
};

const ko_demo_time_hud_label = /** @type {(inputs: Demo_Time_Hud_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 시간`)
};

/**
* | output |
* | --- |
* | "Universe time" |
*
* @param {Demo_Time_Hud_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_time_hud_label = /** @type {((inputs?: Demo_Time_Hud_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Time_Hud_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_time_hud_label(inputs)
	return ko_demo_time_hud_label(inputs)
});