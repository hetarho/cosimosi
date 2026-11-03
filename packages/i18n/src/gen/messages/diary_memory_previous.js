/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Memory_PreviousInputs */

const en_diary_memory_previous = /** @type {(inputs: Diary_Memory_PreviousInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Previous star`)
};

const ko_diary_memory_previous = /** @type {(inputs: Diary_Memory_PreviousInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이전 별`)
};

/**
* | output |
* | --- |
* | "Previous star" |
*
* @param {Diary_Memory_PreviousInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_memory_previous = /** @type {((inputs?: Diary_Memory_PreviousInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Memory_PreviousInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_memory_previous(inputs)
	return ko_diary_memory_previous(inputs)
});