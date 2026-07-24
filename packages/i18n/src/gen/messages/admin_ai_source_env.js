/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Source_EnvInputs */

const en_admin_ai_source_env = /** @type {(inputs: Admin_Ai_Source_EnvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Environment`)
};

const ko_admin_ai_source_env = /** @type {(inputs: Admin_Ai_Source_EnvInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`환경변수`)
};

/**
* | output |
* | --- |
* | "Environment" |
*
* @param {Admin_Ai_Source_EnvInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_source_env = /** @type {((inputs?: Admin_Ai_Source_EnvInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Source_EnvInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_source_env(inputs)
	return ko_admin_ai_source_env(inputs)
});