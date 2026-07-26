/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_CopyInputs */

const en_invite_copy = /** @type {(inputs: Invite_CopyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copy invitation`)
};

const ko_invite_copy = /** @type {(inputs: Invite_CopyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`초대 복사하기`)
};

/**
* | output |
* | --- |
* | "Copy invitation" |
*
* @param {Invite_CopyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_copy = /** @type {((inputs?: Invite_CopyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_CopyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_copy(inputs)
	return ko_invite_copy(inputs)
});