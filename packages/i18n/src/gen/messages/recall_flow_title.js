/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recall_Flow_TitleInputs */

const en_recall_flow_title = /** @type {(inputs: Recall_Flow_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recall`)
};

const ko_recall_flow_title = /** @type {(inputs: Recall_Flow_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회고`)
};

/**
* | output |
* | --- |
* | "Recall" |
*
* @param {Recall_Flow_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_flow_title = /** @type {((inputs?: Recall_Flow_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Flow_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_flow_title(inputs)
	return ko_recall_flow_title(inputs)
});