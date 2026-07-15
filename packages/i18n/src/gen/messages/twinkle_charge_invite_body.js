/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_BodyInputs */

const en_twinkle_charge_invite_body = /** @type {(inputs: Twinkle_Charge_Invite_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`When a friend joins, you both receive stardust.`)
};

const ko_twinkle_charge_invite_body = /** @type {(inputs: Twinkle_Charge_Invite_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`친구가 함께하면 둘 다 별가루를 받아요.`)
};

/**
* | output |
* | --- |
* | "When a friend joins, you both receive stardust." |
*
* @param {Twinkle_Charge_Invite_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_body = /** @type {((inputs?: Twinkle_Charge_Invite_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_body(inputs)
	return ko_twinkle_charge_invite_body(inputs)
});