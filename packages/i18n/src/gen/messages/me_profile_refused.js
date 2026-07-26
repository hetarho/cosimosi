/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Profile_RefusedInputs */

const en_me_profile_refused = /** @type {(inputs: Me_Profile_RefusedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your profile could not be read.`)
};

const ko_me_profile_refused = /** @type {(inputs: Me_Profile_RefusedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프로필을 읽지 못했어요.`)
};

/**
* | output |
* | --- |
* | "Your profile could not be read." |
*
* @param {Me_Profile_RefusedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_profile_refused = /** @type {((inputs?: Me_Profile_RefusedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Profile_RefusedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_profile_refused(inputs)
	return ko_me_profile_refused(inputs)
});