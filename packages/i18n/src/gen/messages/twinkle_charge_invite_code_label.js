/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_Code_LabelInputs */

const en_twinkle_charge_invite_code_label = /** @type {(inputs: Twinkle_Charge_Invite_Code_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invite code`)
};

const ko_twinkle_charge_invite_code_label = /** @type {(inputs: Twinkle_Charge_Invite_Code_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`초대 코드`)
};

/**
* | output |
* | --- |
* | "Invite code" |
*
* @param {Twinkle_Charge_Invite_Code_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_code_label = /** @type {((inputs?: Twinkle_Charge_Invite_Code_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_Code_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_code_label(inputs)
	return ko_twinkle_charge_invite_code_label(inputs)
});