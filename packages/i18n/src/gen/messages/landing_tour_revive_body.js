/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Revive_BodyInputs */

const en_landing_tour_revive_body = /** @type {(inputs: Landing_Tour_Revive_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Return to a faded one and it brightens — and comes back a little changed, the way remembering actually works.`)
};

const ko_landing_tour_revive_body = /** @type {(inputs: Landing_Tour_Revive_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`희미해진 것을 다시 찾으면 밝아집니다. 그리고 조금 달라진 채로 돌아옵니다. 기억이 실제로 그렇게 작동하는 것처럼.`)
};

/**
* | output |
* | --- |
* | "Return to a faded one and it brightens — and comes back a little changed, the way remembering actually works." |
*
* @param {Landing_Tour_Revive_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_revive_body = /** @type {((inputs?: Landing_Tour_Revive_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Revive_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_revive_body(inputs)
	return ko_landing_tour_revive_body(inputs)
});