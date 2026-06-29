/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Shell_Home_DescriptionInputs */

const en_mobile_shell_home_description = /** @type {(inputs: Mobile_Shell_Home_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Phase 1 provider seams are mounted. Product screens arrive in later phases.`)
};

const ko_mobile_shell_home_description = /** @type {(inputs: Mobile_Shell_Home_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Phase 1 provider seam이 마운트되었습니다. 제품 화면은 이후 단계에서 추가됩니다.`)
};

/**
* | output |
* | --- |
* | "Phase 1 provider seams are mounted. Product screens arrive in later phases." |
*
* @param {Mobile_Shell_Home_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_shell_home_description = /** @type {((inputs?: Mobile_Shell_Home_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Shell_Home_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_shell_home_description(inputs)
	return ko_mobile_shell_home_description(inputs)
});