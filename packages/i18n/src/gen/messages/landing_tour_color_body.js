/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Color_BodyInputs */

const en_landing_tour_color_body = /** @type {(inputs: Landing_Tour_Color_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The whole background settles into the feelings you keep coming back to, so a year has a colour you can see at a glance.`)
};

const ko_landing_tour_color_body = /** @type {(inputs: Landing_Tour_Color_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`배경 전체가 당신이 자주 돌아오는 감정으로 가라앉습니다. 한 해가 한눈에 보이는 색을 갖게 됩니다.`)
};

/**
* | output |
* | --- |
* | "The whole background settles into the feelings you keep coming back to, so a year has a colour you can see at a glance." |
*
* @param {Landing_Tour_Color_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_color_body = /** @type {((inputs?: Landing_Tour_Color_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Color_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_color_body(inputs)
	return ko_landing_tour_color_body(inputs)
});