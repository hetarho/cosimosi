/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Recall_ActionInputs */

const en_demo_recall_action = /** @type {(inputs: Demo_Recall_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall`)
};

const ko_demo_recall_action = /** @type {(inputs: Demo_Recall_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회고하기`)
};

/**
* | output |
* | --- |
* | "Recall" |
*
* @param {Demo_Recall_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_recall_action = /** @type {((inputs?: Demo_Recall_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Recall_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_recall_action(inputs)
	return ko_demo_recall_action(inputs)
});