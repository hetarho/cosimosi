/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Timezone_NoticeInputs */

const en_me_timezone_notice = /** @type {(inputs: Me_Timezone_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Changing the timezone does not refill today's small stardust.`)
};

const ko_me_timezone_notice = /** @type {(inputs: Me_Timezone_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시간대를 바꿔도 오늘의 작은 별가루는 다시 채워지지 않아요.`)
};

/**
* | output |
* | --- |
* | "Changing the timezone does not refill today's small stardust." |
*
* @param {Me_Timezone_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_timezone_notice = /** @type {((inputs?: Me_Timezone_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Timezone_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_timezone_notice(inputs)
	return ko_me_timezone_notice(inputs)
});