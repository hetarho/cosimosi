/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Usage_WindowInputs */

const en_admin_usage_window = /** @type {(inputs: Admin_Usage_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Window (UTC)`)
};

const ko_admin_usage_window = /** @type {(inputs: Admin_Usage_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기준일(UTC)`)
};

/**
* | output |
* | --- |
* | "Window (UTC)" |
*
* @param {Admin_Usage_WindowInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_usage_window = /** @type {((inputs?: Admin_Usage_WindowInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Usage_WindowInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_usage_window(inputs)
	return ko_admin_usage_window(inputs)
});