/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Entry_Current_LabelInputs */

const en_demo_entry_current_label = /** @type {(inputs: Demo_Entry_Current_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What the words are now`)
};

const ko_demo_entry_current_label = /** @type {(inputs: Demo_Entry_Current_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 남아 있는 문장`)
};

/**
* | output |
* | --- |
* | "What the words are now" |
*
* @param {Demo_Entry_Current_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_entry_current_label = /** @type {((inputs?: Demo_Entry_Current_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Entry_Current_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_entry_current_label(inputs)
	return ko_demo_entry_current_label(inputs)
});