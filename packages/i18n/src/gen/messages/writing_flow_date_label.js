/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Date_LabelInputs */

const en_writing_flow_date_label = /** @type {(inputs: Writing_Flow_Date_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Date`)
};

const ko_writing_flow_date_label = /** @type {(inputs: Writing_Flow_Date_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`날짜`)
};

/**
* | output |
* | --- |
* | "Date" |
*
* @param {Writing_Flow_Date_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_date_label = /** @type {((inputs?: Writing_Flow_Date_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Date_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_date_label(inputs)
	return ko_writing_flow_date_label(inputs)
});