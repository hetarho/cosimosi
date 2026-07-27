/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Invite_SignupInputs */

const en_me_stardust_reason_invite_signup = /** @type {(inputs: Me_Stardust_Reason_Invite_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You started from an invite`)
};

const ko_me_stardust_reason_invite_signup = /** @type {(inputs: Me_Stardust_Reason_Invite_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`초대로 시작해서`)
};

/**
* | output |
* | --- |
* | "You started from an invite" |
*
* @param {Me_Stardust_Reason_Invite_SignupInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_invite_signup = /** @type {((inputs?: Me_Stardust_Reason_Invite_SignupInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Invite_SignupInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_invite_signup(inputs)
	return ko_me_stardust_reason_invite_signup(inputs)
});