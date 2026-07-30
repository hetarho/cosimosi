/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Write_BodyInputs */

const en_landing_tour_write_body = /** @type {(inputs: Landing_Tour_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One entry rarely holds one thing. It comes apart into the few scenes it was made of, and each of them rises.`)
};

const ko_landing_tour_write_body = /** @type {(inputs: Landing_Tour_Write_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 편의 일기에 한 가지만 담기는 일은 드뭅니다. 그 안의 몇 장면으로 쪼개지고, 각각이 떠오릅니다.`)
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