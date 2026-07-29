/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ title: NonNullable<unknown> }} Achievement_NoticeInputs */

const en_achievement_notice = /** @type {(inputs: Achievement_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.title} — waiting in your records.`)
};

const ko_achievement_notice = /** @type {(inputs: Achievement_NoticeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.title} — 기록에서 기다리고 있어요.`)
};

/**
* | output |
* | --- |
* | "{title} — waiting in your records." |
*
* @param {Achievement_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_notice = /** @type {((inputs: Achievement_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_notice(inputs)
	return ko_achievement_notice(inputs)
});