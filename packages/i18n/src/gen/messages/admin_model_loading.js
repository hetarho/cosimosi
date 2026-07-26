/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_LoadingInputs */

const en_admin_model_loading = /** @type {(inputs: Admin_Model_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading model list…`)
};

const ko_admin_model_loading = /** @type {(inputs: Admin_Model_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모델 목록 불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Loading model list…" |
*
* @param {Admin_Model_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_loading = /** @type {((inputs?: Admin_Model_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_loading(inputs)
	return ko_admin_model_loading(inputs)
});