/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_UnavailableInputs */

const en_invite_unavailable = /** @type {(inputs: Invite_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`An invitation link is not available right now.`)
};

const ko_invite_unavailable = /** @type {(inputs: Invite_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 초대 링크를 열지 못했어요.`)
};

/**
* | output |
* | --- |
* | "An invitation link is not available right now." |
*
* @param {Invite_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_unavailable = /** @type {((inputs?: Invite_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_unavailable(inputs)
	return ko_invite_unavailable(inputs)
});