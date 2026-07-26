/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_ShareInputs */

const en_invite_share = /** @type {(inputs: Invite_ShareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Share invitation`)
};

const ko_invite_share = /** @type {(inputs: Invite_ShareInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`초대 나누기`)
};

/**
* | output |
* | --- |
* | "Share invitation" |
*
* @param {Invite_ShareInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_share = /** @type {((inputs?: Invite_ShareInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_ShareInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_share(inputs)
	return ko_invite_share(inputs)
});