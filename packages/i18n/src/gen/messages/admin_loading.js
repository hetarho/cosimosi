/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_LoadingInputs */

const en_admin_loading = /** @type {(inputs: Admin_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading…`)
};

const ko_admin_loading = /** @type {(inputs: Admin_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Loading…" |
*
* @param {Admin_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_loading = /** @type {((inputs?: Admin_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_loading(inputs)
	return ko_admin_loading(inputs)
});