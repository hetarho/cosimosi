/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Diary_Read_ActionInputs */

const en_demo_diary_read_action = /** @type {(inputs: Demo_Diary_Read_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`I've read it`)
};

const ko_demo_diary_read_action = /** @type {(inputs: Demo_Diary_Read_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`읽었어요`)
};

/**
* | output |
* | --- |
* | "I've read it" |
*
* @param {Demo_Diary_Read_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_diary_read_action = /** @type {((inputs?: Demo_Diary_Read_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Diary_Read_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_diary_read_action(inputs)
	return ko_demo_diary_read_action(inputs)
});