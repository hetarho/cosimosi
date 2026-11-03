/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Recall_BeforeInputs */

const en_demo_recall_before = /** @type {(inputs: Demo_Recall_BeforeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Before recall`)
};

const ko_demo_recall_before = /** @type {(inputs: Demo_Recall_BeforeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회상 전`)
};

/**
* | output |
* | --- |
* | "Before recall" |
*
* @param {Demo_Recall_BeforeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_recall_before = /** @type {((inputs?: Demo_Recall_BeforeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Recall_BeforeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_recall_before(inputs)
	return ko_demo_recall_before(inputs)
});