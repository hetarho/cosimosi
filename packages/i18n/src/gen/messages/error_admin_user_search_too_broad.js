/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Admin_User_Search_Too_BroadInputs */

const en_error_admin_user_search_too_broad = /** @type {(inputs: Error_Admin_User_Search_Too_BroadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The search was too broad to finish. Try a longer search term.`)
};

const ko_error_admin_user_search_too_broad = /** @type {(inputs: Error_Admin_User_Search_Too_BroadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`검색어가 너무 짧아 계정을 다 훑지 못했어요. 더 길게 입력해 주세요.`)
};

/**
* | output |
* | --- |
* | "The search was too broad to finish. Try a longer search term." |
*
* @param {Error_Admin_User_Search_Too_BroadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_admin_user_search_too_broad = /** @type {((inputs?: Error_Admin_User_Search_Too_BroadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Admin_User_Search_Too_BroadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_admin_user_search_too_broad(inputs)
	return ko_error_admin_user_search_too_broad(inputs)
});