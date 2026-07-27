/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_InviteInputs */

const en_me_stardust_reason_invite = /** @type {(inputs: Me_Stardust_Reason_InviteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A friend joined you`)
};

const ko_me_stardust_reason_invite = /** @type {(inputs: Me_Stardust_Reason_InviteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`친구가 함께해서`)
};

/**
* | output |
* | --- |
* | "A friend joined you" |
*
* @param {Me_Stardust_Reason_InviteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_invite = /** @type {((inputs?: Me_Stardust_Reason_InviteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_InviteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_invite(inputs)
	return ko_me_stardust_reason_invite(inputs)
});