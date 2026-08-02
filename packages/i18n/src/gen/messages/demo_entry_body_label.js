/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Entry_Body_LabelInputs */

const en_demo_entry_body_label = /** @type {(inputs: Demo_Entry_Body_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The diary, as written`)
};

const ko_demo_entry_body_label = /** @type {(inputs: Demo_Entry_Body_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그날의 일기`)
};

/**
* | output |
* | --- |
* | "The diary, as written" |
*
* @param {Demo_Entry_Body_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_entry_body_label = /** @type {((inputs?: Demo_Entry_Body_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Entry_Body_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_entry_body_label(inputs)
	return ko_demo_entry_body_label(inputs)
});