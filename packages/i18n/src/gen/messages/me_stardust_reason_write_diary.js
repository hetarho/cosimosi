/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Write_DiaryInputs */

const en_me_stardust_reason_write_diary = /** @type {(inputs: Me_Stardust_Reason_Write_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`For writing a diary`)
};

const ko_me_stardust_reason_write_diary = /** @type {(inputs: Me_Stardust_Reason_Write_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기를 써서`)
};

/**
* | output |
* | --- |
* | "For writing a diary" |
*
* @param {Me_Stardust_Reason_Write_DiaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_write_diary = /** @type {((inputs?: Me_Stardust_Reason_Write_DiaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Write_DiaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_write_diary(inputs)
	return ko_me_stardust_reason_write_diary(inputs)
});