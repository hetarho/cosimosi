/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Achievement_Claimable_CountInputs */

const en_achievement_claimable_count = /** @type {(inputs: Achievement_Claimable_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} rewards are waiting.`)
};

const ko_achievement_claimable_count = /** @type {(inputs: Achievement_Claimable_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`받을 보상이 ${i?.count}개 있어요.`)
};

/**
* | output |
* | --- |
* | "{count} rewards are waiting." |
*
* @param {Achievement_Claimable_CountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_claimable_count = /** @type {((inputs: Achievement_Claimable_CountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Claimable_CountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_claimable_count(inputs)
	return ko_achievement_claimable_count(inputs)
});