/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_TitleInputs */

const en_invite_title = /** @type {(inputs: Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your invitation`)
};

const ko_invite_title = /** @type {(inputs: Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`나의 초대`)
};

/**
* | output |
* | --- |
* | "Your invitation" |
*
* @param {Invite_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_title = /** @type {((inputs?: Invite_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_title(inputs)
	return ko_invite_title(inputs)
});