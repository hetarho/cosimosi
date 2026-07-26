/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Nickname_LabelInputs */

const en_signup_nickname_label = /** @type {(inputs: Signup_Nickname_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What should you be called here?`)
};

const ko_signup_nickname_label = /** @type {(inputs: Signup_Nickname_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기서는 어떤 이름으로 불릴까요`)
};

/**
* | output |
* | --- |
* | "What should you be called here?" |
*
* @param {Signup_Nickname_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_nickname_label = /** @type {((inputs?: Signup_Nickname_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Nickname_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_nickname_label(inputs)
	return ko_signup_nickname_label(inputs)
});