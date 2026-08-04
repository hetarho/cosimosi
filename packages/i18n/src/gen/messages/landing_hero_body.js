/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Hero_BodyInputs */

const en_landing_hero_body = /** @type {(inputs: Landing_Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write down today and it comes apart into memories; each memory becomes a star and fills the universe. Fill yours with what you remember.`)
};

const ko_landing_hero_body = /** @type {(inputs: Landing_Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오늘 쓴 일기는 기억으로 쪼개지고, 기억은 하나씩 별이 되어 밤하늘로 올라가요. 내 기억으로 우주를 채워 보세요.`)
};

/**
* | output |
* | --- |
* | "Write down today and it comes apart into memories; each memory becomes a star and fills the universe. Fill yours with what you remember." |
*
* @param {Landing_Hero_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_hero_body = /** @type {((inputs?: Landing_Hero_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Hero_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_hero_body(inputs)
	return ko_landing_hero_body(inputs)
});