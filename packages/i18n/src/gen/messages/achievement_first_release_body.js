/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Release_BodyInputs */

const en_achievement_first_release_body = /** @type {(inputs: Achievement_First_Release_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You chose to stop carrying something. That is also keeping it.`)
};

const ko_achievement_first_release_body = /** @type {(inputs: Achievement_First_Release_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그만 안고 있기로 했어요. 그것도 지키는 방법이에요.`)
};

/**
* | output |
* | --- |
* | "You chose to stop carrying something. That is also keeping it." |
*
* @param {Achievement_First_Release_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_release_body = /** @type {((inputs?: Achievement_First_Release_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Release_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_release_body(inputs)
	return ko_achievement_first_release_body(inputs)
});