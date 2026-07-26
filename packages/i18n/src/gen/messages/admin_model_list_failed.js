/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_List_FailedInputs */

const en_admin_model_list_failed = /** @type {(inputs: Admin_Model_List_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Couldn't fetch the model list — enter the id directly.`)
};

const ko_admin_model_list_failed = /** @type {(inputs: Admin_Model_List_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모델 목록을 가져오지 못했어요 — ID를 직접 입력하세요.`)
};

/**
* | output |
* | --- |
* | "Couldn't fetch the model list — enter the id directly." |
*
* @param {Admin_Model_List_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_list_failed = /** @type {((inputs?: Admin_Model_List_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_List_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_list_failed(inputs)
	return ko_admin_model_list_failed(inputs)
});