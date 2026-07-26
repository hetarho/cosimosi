/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_AcknowledgmentInputs */

const en_invite_acknowledgment = /** @type {(inputs: Invite_AcknowledgmentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You arrived through an invitation.`)
};

const ko_invite_acknowledgment = /** @type {(inputs: Invite_AcknowledgmentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`초대를 따라 이곳에 도착했어요.`)
};

/**
* | output |
* | --- |
* | "You arrived through an invitation." |
*
* @param {Invite_AcknowledgmentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_acknowledgment = /** @type {((inputs?: Invite_AcknowledgmentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_AcknowledgmentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_acknowledgment(inputs)
	return ko_invite_acknowledgment(inputs)
});