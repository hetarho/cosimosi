/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Gist_View_BodyInputs */

const en_achievement_first_gist_view_body = /** @type {(inputs: Achievement_First_Gist_View_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You read what a memory had become rather than what it was.`)
};

const ko_achievement_first_gist_view_body = /** @type {(inputs: Achievement_First_Gist_View_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무엇이었는지가 아니라 무엇이 되었는지를 읽었어요.`)
};

/**
* | output |
* | --- |
* | "You read what a memory had become rather than what it was." |
*
* @param {Achievement_First_Gist_View_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_gist_view_body = /** @type {((inputs?: Achievement_First_Gist_View_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Gist_View_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_gist_view_body(inputs)
	return ko_achievement_first_gist_view_body(inputs)
});