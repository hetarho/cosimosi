/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_Pick_From_ListInputs */

const en_admin_model_pick_from_list = /** @type {(inputs: Admin_Model_Pick_From_ListInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to the list`)
};

const ko_admin_model_pick_from_list = /** @type {(inputs: Admin_Model_Pick_From_ListInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`목록에서 선택`)
};

/**
* | output |
* | --- |
* | "Back to the list" |
*
* @param {Admin_Model_Pick_From_ListInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_pick_from_list = /** @type {((inputs?: Admin_Model_Pick_From_ListInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_Pick_From_ListInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_pick_from_list(inputs)
	return ko_admin_model_pick_from_list(inputs)
});