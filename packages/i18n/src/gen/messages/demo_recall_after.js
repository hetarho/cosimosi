/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Recall_AfterInputs */

const en_demo_recall_after = /** @type {(inputs: Demo_Recall_AfterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`After recall`)
};

const ko_demo_recall_after = /** @type {(inputs: Demo_Recall_AfterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회상 후`)
};

/**
* | output |
* | --- |
* | "After recall" |
*
* @param {Demo_Recall_AfterInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_recall_after = /** @type {((inputs?: Demo_Recall_AfterInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Recall_AfterInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_recall_after(inputs)
	return ko_demo_recall_after(inputs)
});