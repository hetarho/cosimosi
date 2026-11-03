/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_Daily_BodyInputs */

const en_twinkle_earn_daily_body = /** @type {(inputs: Twinkle_Earn_Daily_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Small stardust refills daily for restoring stored words and reading gists. Reconstructing a memory is free.`)
};

const ko_twinkle_earn_daily_body = /** @type {(inputs: Twinkle_Earn_Daily_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`작은 별가루는 매일 다시 채워져요. 원문을 되살리거나 요지를 읽을 때 사용할 수 있어요. 회고하기는 무료예요.`)
};

/**
* | output |
* | --- |
* | "Small stardust refills daily for restoring stored words and reading gists. Reconstructing a memory is free." |
*
* @param {Twinkle_Earn_Daily_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_daily_body = /** @type {((inputs?: Twinkle_Earn_Daily_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_Daily_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_daily_body(inputs)
	return ko_twinkle_earn_daily_body(inputs)
});