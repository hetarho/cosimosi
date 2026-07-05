/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Past_Date_ConfirmInputs */

const en_writing_flow_past_date_confirm = /** @type {(inputs: Writing_Flow_Past_Date_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Keep it`)
};

const ko_writing_flow_past_date_confirm = /** @type {(inputs: Writing_Flow_Past_Date_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`보관하기`)
};

/**
* | output |
* | --- |
* | "Keep it" |
*
* @param {Writing_Flow_Past_Date_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_past_date_confirm = /** @type {((inputs?: Writing_Flow_Past_Date_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Past_Date_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_past_date_confirm(inputs)
	return ko_writing_flow_past_date_confirm(inputs)
});