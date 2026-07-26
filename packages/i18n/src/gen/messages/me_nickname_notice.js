/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ min: NonNullable<unknown>, max: NonNullable<unknown> }} Me_Nickname_NoticeInputs */

const en_me_nickname_notice = /** @type {(inputs: Me_Nickname_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Use ${i?.min}–${i?.max} characters.`)
};

const ko_me_nickname_notice = /** @type {(inputs: Me_Nickname_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.min}–${i?.max}글자로 적어 주세요.`)
};

/**
* | output |
* | --- |
* | "Use {min}–{max} characters." |
*
* @param {Me_Nickname_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_nickname_notice = /** @type {((inputs: Me_Nickname_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Nickname_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_nickname_notice(inputs)
	return ko_me_nickname_notice(inputs)
});