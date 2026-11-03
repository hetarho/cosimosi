/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Memory_Words_LabelInputs */

const en_demo_memory_words_label = /** @type {(inputs: Demo_Memory_Words_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What remains of this memory`)
};

const ko_demo_memory_words_label = /** @type {(inputs: Demo_Memory_Words_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 남아 있는 문장`)
};

/**
* | output |
* | --- |
* | "What remains of this memory" |
*
* @param {Demo_Memory_Words_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_memory_words_label = /** @type {((inputs?: Demo_Memory_Words_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Memory_Words_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_memory_words_label(inputs)
	return ko_demo_memory_words_label(inputs)
});