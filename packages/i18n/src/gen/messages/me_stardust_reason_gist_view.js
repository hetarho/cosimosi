/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Gist_ViewInputs */

const en_me_stardust_reason_gist_view = /** @type {(inputs: Me_Stardust_Reason_Gist_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`While opening a gist`)
};

const ko_me_stardust_reason_gist_view = /** @type {(inputs: Me_Stardust_Reason_Gist_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지를 열며`)
};

/**
* | output |
* | --- |
* | "While opening a gist" |
*
* @param {Me_Stardust_Reason_Gist_ViewInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_gist_view = /** @type {((inputs?: Me_Stardust_Reason_Gist_ViewInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Gist_ViewInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_gist_view(inputs)
	return ko_me_stardust_reason_gist_view(inputs)
});