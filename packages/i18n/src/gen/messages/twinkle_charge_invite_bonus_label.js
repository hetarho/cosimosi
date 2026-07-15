/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_Bonus_LabelInputs */

const en_twinkle_charge_invite_bonus_label = /** @type {(inputs: Twinkle_Charge_Invite_Bonus_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each of you receives`)
};

const ko_twinkle_charge_invite_bonus_label = /** @type {(inputs: Twinkle_Charge_Invite_Bonus_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`둘 다 받는 별가루`)
};

/**
* | output |
* | --- |
* | "Each of you receives" |
*
* @param {Twinkle_Charge_Invite_Bonus_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_bonus_label = /** @type {((inputs?: Twinkle_Charge_Invite_Bonus_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_Bonus_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_bonus_label(inputs)
	return ko_twinkle_charge_invite_bonus_label(inputs)
});