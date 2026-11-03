/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_No_Missing_WordsInputs */

const en_recall_no_missing_words = /** @type {(inputs: Recall_No_Missing_WordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No words have faded yet. You can recall this memory as it reads.`)
};

const ko_recall_no_missing_words = /** @type {(inputs: Recall_No_Missing_WordsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 흐려진 부분이 없어요. 이 기억을 그대로 다시 떠올릴 수 있어요.`)
};

/**
* | output |
* | --- |
* | "No words have faded yet. You can recall this memory as it reads." |
*
* @param {Recall_No_Missing_WordsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_no_missing_words = /** @type {((inputs?: Recall_No_Missing_WordsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_No_Missing_WordsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_no_missing_words(inputs)
	return ko_recall_no_missing_words(inputs)
});