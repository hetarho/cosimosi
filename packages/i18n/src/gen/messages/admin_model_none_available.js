/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_None_AvailableInputs */

const en_admin_model_none_available = /** @type {(inputs: Admin_Model_None_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No keyed provider yet. Set a key above first.`)
};

const ko_admin_model_none_available = /** @type {(inputs: Admin_Model_None_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`키가 설정된 공급자가 없어요. 먼저 위에서 키를 등록하세요.`)
};

/**
* | output |
* | --- |
* | "No keyed provider yet. Set a key above first." |
*
* @param {Admin_Model_None_AvailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_none_available = /** @type {((inputs?: Admin_Model_None_AvailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_None_AvailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_none_available(inputs)
	return ko_admin_model_none_available(inputs)
});