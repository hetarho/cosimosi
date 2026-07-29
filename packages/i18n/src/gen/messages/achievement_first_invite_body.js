/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Invite_BodyInputs */

const en_achievement_first_invite_body = /** @type {(inputs: Achievement_First_Invite_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A friend started their own universe from your invitation.`)
};

const ko_achievement_first_invite_body = /** @type {(inputs: Achievement_First_Invite_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`친구가 당신의 초대로 자기 우주를 시작했어요.`)
};

/**
* | output |
* | --- |
* | "A friend started their own universe from your invitation." |
*
* @param {Achievement_First_Invite_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_invite_body = /** @type {((inputs?: Achievement_First_Invite_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Invite_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_invite_body(inputs)
	return ko_achievement_first_invite_body(inputs)
});