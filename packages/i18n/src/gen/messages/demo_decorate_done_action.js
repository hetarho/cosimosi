/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Decorate_Done_ActionInputs */

const en_demo_decorate_done_action = /** @type {(inputs: Demo_Decorate_Done_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Return to the universe`)
};

const ko_demo_decorate_done_action = /** @type {(inputs: Demo_Decorate_Done_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Return to the universe" |
*
* @param {Demo_Decorate_Done_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_decorate_done_action = /** @type {((inputs?: Demo_Decorate_Done_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Decorate_Done_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_decorate_done_action(inputs)
	return ko_demo_decorate_done_action(inputs)
});