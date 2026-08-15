/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Group_Mote_Field_TitleInputs */

const en_store_group_mote_field_title = /** @type {(inputs: Store_Group_Mote_Field_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Where the motes sit`)
};

const ko_store_group_mote_field_title = /** @type {(inputs: Store_Group_Mote_Field_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`알갱이가 놓인 자리`)
};

/**
* | output |
* | --- |
* | "Where the motes sit" |
*
* @param {Store_Group_Mote_Field_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_group_mote_field_title = /** @type {((inputs?: Store_Group_Mote_Field_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Group_Mote_Field_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_group_mote_field_title(inputs)
	return ko_store_group_mote_field_title(inputs)
});