/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_ActionInputs */

const en_twinkle_charge_invite_action = /** @type {(inputs: Twinkle_Charge_Invite_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Redeem`)
};

const ko_twinkle_charge_invite_action = /** @type {(inputs: Twinkle_Charge_Invite_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받기`)
};

/**
* | output |
* | --- |
* | "Redeem" |
*
* @param {Twinkle_Charge_Invite_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_action = /** @type {((inputs?: Twinkle_Charge_Invite_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_action(inputs)
	return ko_twinkle_charge_invite_action(inputs)
});