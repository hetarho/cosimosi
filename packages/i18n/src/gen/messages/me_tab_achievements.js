/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Tab_AchievementsInputs */

const en_me_tab_achievements = /** @type {(inputs: Me_Tab_AchievementsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Achievements`)
};

const ko_me_tab_achievements = /** @type {(inputs: Me_Tab_AchievementsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`업적`)
};

/**
* | output |
* | --- |
* | "Achievements" |
*
* @param {Me_Tab_AchievementsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_tab_achievements = /** @type {((inputs?: Me_Tab_AchievementsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Tab_AchievementsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_tab_achievements(inputs)
	return ko_me_tab_achievements(inputs)
});