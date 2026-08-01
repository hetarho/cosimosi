/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Write_BodyInputs */

const en_landing_tour_write_body = /** @type {(inputs: Landing_Tour_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One entry rarely holds one thing. It comes apart into the few scenes it was made of, and each of them rises.`)
};

const ko_landing_tour_write_body = /** @type {(inputs: Landing_Tour_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 한 편에 한 가지 이야기만 담기는 일은 드물죠. 그래서 일기는 몇 개의 장면으로 나뉘고, 각각 별이 되어 떠올라요.`)
};

/**
* | output |
* | --- |
* | "One entry rarely holds one thing. It comes apart into the few scenes it was made of, and each of them rises." |
*
* @param {Landing_Tour_Write_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_write_body = /** @type {((inputs?: Landing_Tour_Write_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Write_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_write_body(inputs)
	return ko_landing_tour_write_body(inputs)
});