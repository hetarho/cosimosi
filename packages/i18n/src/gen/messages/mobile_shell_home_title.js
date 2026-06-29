/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Shell_Home_TitleInputs */

const en_mobile_shell_home_title = /** @type {(inputs: Mobile_Shell_Home_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Mobile shell ready`)
};

const ko_mobile_shell_home_title = /** @type {(inputs: Mobile_Shell_Home_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모바일 셸 준비 완료`)
};

/**
* | output |
* | --- |
* | "Mobile shell ready" |
*
* @param {Mobile_Shell_Home_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_shell_home_title = /** @type {((inputs?: Mobile_Shell_Home_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Shell_Home_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_shell_home_title(inputs)
	return ko_mobile_shell_home_title(inputs)
});