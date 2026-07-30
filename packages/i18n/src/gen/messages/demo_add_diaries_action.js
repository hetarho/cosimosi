/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Add_Diaries_ActionInputs */

const en_demo_add_diaries_action = /** @type {(inputs: Demo_Add_Diaries_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add two more entries`)
};

const ko_demo_add_diaries_action = /** @type {(inputs: Demo_Add_Diaries_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 두 편 더`)
};

/**
* | output |
* | --- |
* | "Add two more entries" |
*
* @param {Demo_Add_Diaries_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_add_diaries_action = /** @type {((inputs?: Demo_Add_Diaries_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Add_Diaries_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_add_diaries_action(inputs)
	return ko_demo_add_diaries_action(inputs)
});