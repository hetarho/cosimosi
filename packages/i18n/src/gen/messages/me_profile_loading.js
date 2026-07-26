/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Profile_LoadingInputs */

const en_me_profile_loading = /** @type {(inputs: Me_Profile_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reading your profile…`)
};

const ko_me_profile_loading = /** @type {(inputs: Me_Profile_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프로필을 읽는 중…`)
};

/**
* | output |
* | --- |
* | "Reading your profile…" |
*
* @param {Me_Profile_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_profile_loading = /** @type {((inputs?: Me_Profile_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Profile_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_profile_loading(inputs)
	return ko_me_profile_loading(inputs)
});