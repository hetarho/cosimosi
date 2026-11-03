/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Memory_NextInputs */

const en_diary_memory_next = /** @type {(inputs: Diary_Memory_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next star`)
};

const ko_diary_memory_next = /** @type {(inputs: Diary_Memory_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음 별`)
};

/**
* | output |
* | --- |
* | "Next star" |
*
* @param {Diary_Memory_NextInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_memory_next = /** @type {((inputs?: Diary_Memory_NextInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Memory_NextInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_memory_next(inputs)
	return ko_diary_memory_next(inputs)
});