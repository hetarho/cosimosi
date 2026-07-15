/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_TitleInputs */

const en_twinkle_charge_invite_title = /** @type {(inputs: Twinkle_Charge_Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invite a friend`)
};

const ko_twinkle_charge_invite_title = /** @type {(inputs: Twinkle_Charge_Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`친구 초대`)
};

/**
* | output |
* | --- |
* | "Invite a friend" |
*
* @param {Twinkle_Charge_Invite_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_title = /** @type {((inputs?: Twinkle_Charge_Invite_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_title(inputs)
	return ko_twinkle_charge_invite_title(inputs)
});