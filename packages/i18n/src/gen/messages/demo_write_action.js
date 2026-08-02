/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Write_ActionInputs */

const en_demo_write_action = /** @type {(inputs: Demo_Write_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write a diary`)
};

const ko_demo_write_action = /** @type {(inputs: Demo_Write_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 쓰기`)
};

/**
* | output |
* | --- |
* | "Write a diary" |
*
* @param {Demo_Write_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_write_action = /** @type {((inputs?: Demo_Write_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Write_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_write_action(inputs)
	return ko_demo_write_action(inputs)
});