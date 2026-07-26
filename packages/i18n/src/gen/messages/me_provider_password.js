/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Provider_PasswordInputs */

const en_me_provider_password = /** @type {(inputs: Me_Provider_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Email and password`)
};

const ko_me_provider_password = /** @type {(inputs: Me_Provider_PasswordInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일과 비밀번호`)
};

/**
* | output |
* | --- |
* | "Email and password" |
*
* @param {Me_Provider_PasswordInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_provider_password = /** @type {((inputs?: Me_Provider_PasswordInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Provider_PasswordInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_provider_password(inputs)
	return ko_me_provider_password(inputs)
});