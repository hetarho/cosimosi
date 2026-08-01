/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Diary_TitleInputs */

const en_landing_walk_diary_title = /** @type {(inputs: Landing_Walk_Diary_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One day's entry`)
};

const ko_landing_walk_diary_title = /** @type {(inputs: Landing_Walk_Diary_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`어느 하루의 일기`)
};

/**
* | output |
* | --- |
* | "One day's entry" |
*
* @param {Landing_Walk_Diary_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_diary_title = /** @type {((inputs?: Landing_Walk_Diary_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Diary_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_diary_title(inputs)
	return ko_landing_walk_diary_title(inputs)
});