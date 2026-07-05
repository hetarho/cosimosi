/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Nebula_Notice_BodyInputs */

const en_universe_nebula_notice_body = /** @type {(inputs: Universe_Nebula_Notice_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This color is the emotions you return to — not the average of what you felt, but the memories you reopen, bled into light.`)
};

const ko_universe_nebula_notice_body = /** @type {(inputs: Universe_Nebula_Notice_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 빛깔은 당신이 되읽는 감정이에요. 느낀 감정의 평균이 아니라, 자주 돌아가 다시 펼쳐 보는 마음이 번져 나온 색이에요.`)
};

/**
* | output |
* | --- |
* | "This color is the emotions you return to — not the average of what you felt, but the memories you reopen, bled into light." |
*
* @param {Universe_Nebula_Notice_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_nebula_notice_body = /** @type {((inputs?: Universe_Nebula_Notice_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Nebula_Notice_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_nebula_notice_body(inputs)
	return ko_universe_nebula_notice_body(inputs)
});