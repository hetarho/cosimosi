/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Color_BodyInputs */

const en_landing_tour_color_body = /** @type {(inputs: Landing_Tour_Color_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The whole background settles into the feelings you keep coming back to, so a year has a colour you can see at a glance.`)
};

const ko_landing_tour_color_body = /** @type {(inputs: Landing_Tour_Color_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`배경 전체가 자주 돌아보는 감정의 색으로 물들어요. 한 해를 한눈에 담은 색이 생기는 거예요.`)
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