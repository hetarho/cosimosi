/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Spatial_BodyInputs */

const en_landing_theory_spatial_body = /** @type {(inputs: Landing_Theory_Spatial_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The machinery for knowing where you are also seems to help organize what you know. That is the licence for showing memories as a space you can look around, rather than a list.`)
};

const ko_landing_theory_spatial_body = /** @type {(inputs: Landing_Theory_Spatial_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`내가 어디에 있는지 아는 감각이 알고 있는 것을 정리할 때도 쓰인다고 해요. 기억을 목록이 아니라 둘러볼 수 있는 공간으로 보여주는 이유예요.`)
};

/**
* | output |
* | --- |
* | "The machinery for knowing where you are also seems to help organize what you know. That is the licence for showing memories as a space you can look around, r..." |
*
* @param {Landing_Theory_Spatial_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_spatial_body = /** @type {((inputs?: Landing_Theory_Spatial_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Spatial_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_spatial_body(inputs)
	return ko_landing_theory_spatial_body(inputs)
});