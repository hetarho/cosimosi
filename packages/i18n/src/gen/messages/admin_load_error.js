/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Load_ErrorInputs */

const en_admin_load_error = /** @type {(inputs: Admin_Load_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to load — check the API server.`)
};

const ko_admin_load_error = /** @type {(inputs: Admin_Load_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불러오지 못했어요 — API 서버 상태를 확인하세요.`)
};

/**
* | output |
* | --- |
* | "Failed to load — check the API server." |
*
* @param {Admin_Load_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_load_error = /** @type {((inputs?: Admin_Load_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Load_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_load_error(inputs)
	return ko_admin_load_error(inputs)
});