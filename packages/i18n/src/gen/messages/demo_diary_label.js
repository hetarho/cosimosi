/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Diary_LabelInputs */

const en_demo_diary_label = /** @type {(inputs: Demo_Diary_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The diary`)
};

const ko_demo_diary_label = /** @type {(inputs: Demo_Diary_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기`)
};

/**
* | output |
* | --- |
* | "The diary" |
*
* @param {Demo_Diary_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_diary_label = /** @type {((inputs?: Demo_Diary_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Diary_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_diary_label(inputs)
	return ko_demo_diary_label(inputs)
});