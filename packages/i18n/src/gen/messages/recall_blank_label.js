/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ position: NonNullable<unknown> }} Recall_Blank_LabelInputs */

const en_recall_blank_label = /** @type {(inputs: Recall_Blank_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Faded part ${i?.position}`)
};

const ko_recall_blank_label = /** @type {(inputs: Recall_Blank_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`흐려진 부분 ${i?.position}`)
};

/**
* | output |
* | --- |
* | "Faded part {position}" |
*
* @param {Recall_Blank_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const recall_blank_label = /** @type {((inputs: Recall_Blank_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recall_Blank_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recall_blank_label(inputs)
	return ko_recall_blank_label(inputs)
});