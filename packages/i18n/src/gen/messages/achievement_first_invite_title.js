/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Invite_TitleInputs */

const en_achievement_first_invite_title = /** @type {(inputs: Achievement_First_Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Someone came`)
};

const ko_achievement_first_invite_title = /** @type {(inputs: Achievement_First_Invite_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`누군가 왔어요`)
};

/**
* | output |
* | --- |
* | "Someone came" |
*
* @param {Achievement_First_Invite_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_invite_title = /** @type {((inputs?: Achievement_First_Invite_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Invite_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_invite_title(inputs)
	return ko_achievement_first_invite_title(inputs)
});