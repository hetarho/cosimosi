/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Constellate_BodyInputs */

const en_landing_tour_constellate_body = /** @type {(inputs: Landing_Tour_Constellate_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Where two entries were about the same person, place or idea, they hang from the same point — and a shape appears that nobody drew.`)
};

const ko_landing_tour_constellate_body = /** @type {(inputs: Landing_Tour_Constellate_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`두 편이 같은 사람, 같은 장소, 같은 생각에 대한 것이었다면 같은 점에 매달립니다. 아무도 그리지 않은 형태가 나타납니다.`)
};

/**
* | output |
* | --- |
* | "Where two entries were about the same person, place or idea, they hang from the same point — and a shape appears that nobody drew." |
*
* @param {Landing_Tour_Constellate_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_constellate_body = /** @type {((inputs?: Landing_Tour_Constellate_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Constellate_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_constellate_body(inputs)
	return ko_landing_tour_constellate_body(inputs)
});