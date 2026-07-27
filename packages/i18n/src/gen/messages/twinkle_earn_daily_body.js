/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_Daily_BodyInputs */

const en_twinkle_earn_daily_body = /** @type {(inputs: Twinkle_Earn_Daily_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Small stardust fills again when the day turns. It is only for recalling.`)
};

const ko_twinkle_earn_daily_body = /** @type {(inputs: Twinkle_Earn_Daily_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`작은 별가루는 하루가 바뀌면 다시 채워져요. 회상에만 써요.`)
};

/**
* | output |
* | --- |
* | "Small stardust fills again when the day turns. It is only for recalling." |
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