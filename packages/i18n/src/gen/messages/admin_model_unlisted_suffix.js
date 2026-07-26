/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_Unlisted_SuffixInputs */

const en_admin_model_unlisted_suffix = /** @type {(inputs: Admin_Model_Unlisted_SuffixInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`(not in the current list)`)
};

const ko_admin_model_unlisted_suffix = /** @type {(inputs: Admin_Model_Unlisted_SuffixInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`(현재 목록에 없음)`)
};

/**
* | output |
* | --- |
* | "(not in the current list)" |
*
* @param {Admin_Model_Unlisted_SuffixInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_unlisted_suffix = /** @type {((inputs?: Admin_Model_Unlisted_SuffixInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_Unlisted_SuffixInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_unlisted_suffix(inputs)
	return ko_admin_model_unlisted_suffix(inputs)
});