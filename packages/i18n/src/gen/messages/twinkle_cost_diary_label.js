/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Cost_Diary_LabelInputs */

const en_twinkle_cost_diary_label = /** @type {(inputs: Twinkle_Cost_Diary_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust to recall this whole diary`)
};

const ko_twinkle_cost_diary_label = /** @type {(inputs: Twinkle_Cost_Diary_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기를 모두 회상하는 별가루`)
};

/**
* | output |
* | --- |
* | "Stardust to recall this whole diary" |
*
* @param {Twinkle_Cost_Diary_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_cost_diary_label = /** @type {((inputs?: Twinkle_Cost_Diary_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Cost_Diary_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_cost_diary_label(inputs)
	return ko_twinkle_cost_diary_label(inputs)
});