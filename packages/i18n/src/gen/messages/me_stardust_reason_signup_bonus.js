/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Signup_BonusInputs */

const en_me_stardust_reason_signup_bonus = /** @type {(inputs: Me_Stardust_Reason_Signup_BonusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A gift for your first day`)
};

const ko_me_stardust_reason_signup_bonus = /** @type {(inputs: Me_Stardust_Reason_Signup_BonusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음 온 날의 선물`)
};

/**
* | output |
* | --- |
* | "A gift for your first day" |
*
* @param {Me_Stardust_Reason_Signup_BonusInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_signup_bonus = /** @type {((inputs?: Me_Stardust_Reason_Signup_BonusInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Signup_BonusInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_signup_bonus(inputs)
	return ko_me_stardust_reason_signup_bonus(inputs)
});