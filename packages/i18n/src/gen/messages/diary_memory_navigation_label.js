/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Memory_Navigation_LabelInputs */

const en_diary_memory_navigation_label = /** @type {(inputs: Diary_Memory_Navigation_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars from this diary`)
};

const ko_diary_memory_navigation_label = /** @type {(inputs: Diary_Memory_Navigation_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기에서 태어난 별`)
};

/**
* | output |
* | --- |
* | "Stars from this diary" |
*
* @param {Diary_Memory_Navigation_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_memory_navigation_label = /** @type {((inputs?: Diary_Memory_Navigation_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Memory_Navigation_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_memory_navigation_label(inputs)
	return ko_diary_memory_navigation_label(inputs)
});