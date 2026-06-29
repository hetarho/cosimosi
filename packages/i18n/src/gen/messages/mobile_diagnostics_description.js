/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_DescriptionInputs */

const en_mobile_diagnostics_description = /** @type {(inputs: Mobile_Diagnostics_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider health for the mobile shell. No secrets or memory content.`)
};

const ko_mobile_diagnostics_description = /** @type {(inputs: Mobile_Diagnostics_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모바일 셸의 provider 상태입니다. 비밀 값이나 메모리 내용은 표시하지 않습니다.`)
};

/**
* | output |
* | --- |
* | "Provider health for the mobile shell. No secrets or memory content." |
*
* @param {Mobile_Diagnostics_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_description = /** @type {((inputs?: Mobile_Diagnostics_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_description(inputs)
	return ko_mobile_diagnostics_description(inputs)
});