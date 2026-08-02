/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Entry_Close_ActionInputs */

const en_demo_entry_close_action = /** @type {(inputs: Demo_Entry_Close_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Close`)
};

const ko_demo_entry_close_action = /** @type {(inputs: Demo_Entry_Close_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`닫기`)
};

/**
* | output |
* | --- |
* | "Close" |
*
* @param {Demo_Entry_Close_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_entry_close_action = /** @type {((inputs?: Demo_Entry_Close_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Entry_Close_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_entry_close_action(inputs)
	return ko_demo_entry_close_action(inputs)
});