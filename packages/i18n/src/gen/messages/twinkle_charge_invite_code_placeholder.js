/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Charge_Invite_Code_PlaceholderInputs */

const en_twinkle_charge_invite_code_placeholder = /** @type {(inputs: Twinkle_Charge_Invite_Code_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter the code you received`)
};

const ko_twinkle_charge_invite_code_placeholder = /** @type {(inputs: Twinkle_Charge_Invite_Code_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받은 코드를 적어요`)
};

/**
* | output |
* | --- |
* | "Enter the code you received" |
*
* @param {Twinkle_Charge_Invite_Code_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_charge_invite_code_placeholder = /** @type {((inputs?: Twinkle_Charge_Invite_Code_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Charge_Invite_Code_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_charge_invite_code_placeholder(inputs)
	return ko_twinkle_charge_invite_code_placeholder(inputs)
});