/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ expiresAt: NonNullable<unknown> }} Invite_ExpiresInputs */

const en_invite_expires = /** @type {(inputs: Invite_ExpiresInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`This link is available until ${i?.expiresAt}.`)
};

const ko_invite_expires = /** @type {(inputs: Invite_ExpiresInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`이 링크는 ${i?.expiresAt}까지 열려 있어요.`)
};

/**
* | output |
* | --- |
* | "This link is available until {expiresAt}." |
*
* @param {Invite_ExpiresInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_expires = /** @type {((inputs: Invite_ExpiresInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_ExpiresInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_expires(inputs)
	return ko_invite_expires(inputs)
});