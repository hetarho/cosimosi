/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_DiaryInputs */

const en_me_tab_diary = /** @type {(inputs: Me_Tab_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diary management`)
};

const ko_me_tab_diary = /** @type {(inputs: Me_Tab_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 관리`)
};

/**
* | output |
* | --- |
* | "Diary management" |
*
* @param {Me_Tab_DiaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_diary = /** @type {((inputs?: Me_Tab_DiaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_DiaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_diary(inputs)
	return ko_me_tab_diary(inputs)
});