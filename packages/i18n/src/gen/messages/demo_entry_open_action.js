/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Entry_Open_ActionInputs */

const en_demo_entry_open_action = /** @type {(inputs: Demo_Entry_Open_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open the entry`)
};

const ko_demo_entry_open_action = /** @type {(inputs: Demo_Entry_Open_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 보기`)
};

/**
* | output |
* | --- |
* | "Open the entry" |
*
* @param {Demo_Entry_Open_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_entry_open_action = /** @type {((inputs?: Demo_Entry_Open_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Entry_Open_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_entry_open_action(inputs)
	return ko_demo_entry_open_action(inputs)
});